import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sessions } from '../session/schema';

export const shares = sqliteTable('shares', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
});
