const { createHash, randomBytes } = require('node:crypto');

const token = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

function createStore(pool, owner) {
  async function transaction(work) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const result = await work(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }

  async function lockAccount(db, email) {
    const { rows } = await db.query('SELECT granted FROM roof_accounts WHERE email = $1 FOR UPDATE', [email]);
    return rows[0];
  }

  return {
    async issue(email, roof, invite = false) {
      return transaction(async db => {
        if (invite || email === owner) {
          await db.query('INSERT INTO roof_accounts (email) VALUES ($1) ON CONFLICT DO NOTHING', [email]);
        }
        const account = await lockAccount(db, email);
        if (!account || (!invite && !account.granted && email !== owner)) return null;

        const { rowCount } = await db.query(`
          UPDATE roof_accounts SET granted = granted OR $2, last_mail_at = now()
          WHERE email = $1 AND (last_mail_at IS NULL OR last_mail_at <= now() - interval '1 minute')
        `, [email, invite]);
        if (!rowCount) return null;

        const key = token();
        await db.query('DELETE FROM roof_links WHERE email = $1 AND expires_at <= now()', [email]);
        await db.query(`
          INSERT INTO roof_links (token_hash, email, roof_config, expires_at)
          VALUES ($1, $2, $3, now() + $4::interval)
        `, [hash(key), email, roof, invite ? '48 hours' : '15 minutes']);
        return key;
      });
    },

    async discard(key) {
      await pool.query('DELETE FROM roof_links WHERE token_hash = $1', [hash(key)]);
    },

    async redeem(key) {
      if (!validToken(key)) return null;
      return transaction(async db => {
        const digest = hash(key);
        const { rows: links } = await db.query('SELECT email FROM roof_links WHERE token_hash = $1 AND expires_at > now()', [digest]);
        if (!links.length) return null;
        const { email } = links[0];
        const account = await lockAccount(db, email);
        if (!account || (!account.granted && email !== owner)) return null;

        const { rows } = await db.query(`
          DELETE FROM roof_links WHERE token_hash = $1 AND expires_at > clock_timestamp()
          RETURNING roof_config
        `, [digest]);
        if (!rows.length) return null;

        const session = token();
        await db.query('DELETE FROM roof_sessions WHERE email = $1 AND expires_at <= now()', [email]);
        await db.query("INSERT INTO roof_sessions VALUES ($1, $2, now() + interval '30 days')", [hash(session), email]);
        await db.query('UPDATE roof_accounts SET accepted_at = COALESCE(accepted_at, now()) WHERE email = $1', [email]);
        return { session, roof: rows[0].roof_config };
      });
    },

    async identify(session) {
      if (!validToken(session)) return null;
      const { rows } = await pool.query(`
        SELECT s.email FROM roof_sessions s JOIN roof_accounts a USING (email)
        WHERE s.token_hash = $1 AND s.expires_at > now() AND (a.granted OR s.email = $2)
      `, [hash(session), owner]);
      return rows[0]?.email ?? null;
    },

    async signOut(session) {
      if (validToken(session)) await pool.query('DELETE FROM roof_sessions WHERE token_hash = $1', [hash(session)]);
    },

    async list() {
      const { rows } = await pool.query('SELECT email, granted, accepted_at FROM roof_accounts WHERE email <> $1 ORDER BY email', [owner]);
      return rows;
    },

    async revoke(email) {
      await transaction(async db => {
        if (!await lockAccount(db, email)) return;
        await db.query('UPDATE roof_accounts SET granted = false, accepted_at = NULL, last_mail_at = NULL WHERE email = $1', [email]);
        await db.query('DELETE FROM roof_links WHERE email = $1', [email]);
        await db.query('DELETE FROM roof_sessions WHERE email = $1', [email]);
      });
    }
  };
}

module.exports = { createStore };
