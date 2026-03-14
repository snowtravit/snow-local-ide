import { Sequelize } from 'sequelize';

const DB_NAME = process.env.DB_NAME || 'cloud_ide';
const DB_USER = process.env.DB_USER || 'ide_user';
const DB_PASS = process.env.DB_PASS || 'ide_password';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function initDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('[DB] PostgreSQL connected successfully');
    await sequelize.sync({ alter: true });
    console.log('[DB] Database synced');
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    console.warn('[DB] Running without database - using in-memory storage');
  }
}
