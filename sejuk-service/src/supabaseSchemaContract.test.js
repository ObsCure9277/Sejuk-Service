import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const schemaSql = readProjectFile('supabase/schema.sql')
const importSql = readProjectFile('supabase/import-current-data.sql')

describe('Supabase schema contract', () => {
  it('keeps operational order metadata on orders and audit metadata on order_history', () => {
    const ordersTable = getCreateTableBlock({ sql: schemaSql, tableName: 'orders' })
    const orderHistoryTable = getCreateTableBlock({
      sql: schemaSql,
      tableName: 'order_history',
    })

    for (const column of [
      'customer_name',
      'phone',
      'address',
      'service_type',
      'problem',
      'quoted_price',
      'final_amount',
      'completion_work_done',
      'completion_extra_charges',
      'completion_remarks',
      'evidence',
      'payment_received',
      'payment_amount',
      'payment_method',
      'receipt_file_name',
    ]) {
      assert.match(ordersTable, new RegExp(`\\b${column}\\b`))
    }

    for (const column of ['order_id', 'actor_user_id', 'actor_label', 'action', 'occurred_at']) {
      assert.match(orderHistoryTable, new RegExp(`\\b${column}\\b`))
    }
  })

  it('imports current data as operational upserts for existing orders', () => {
    const conflictClause = getConflictClause({
      columnName: 'order_number',
      sql: importSql,
    })

    assert.doesNotMatch(conflictClause, /do nothing/i)

    for (const column of [
      'customer_name',
      'phone',
      'address',
      'service_type',
      'problem',
      'quoted_price',
      'final_amount',
      'completion_work_done',
      'completion_extra_charges',
      'completion_remarks',
      'evidence',
      'payment_received',
      'payment_amount',
      'payment_method',
      'receipt_file_name',
      'assigned_technician_id',
      'admin_notes',
      'status',
      'completed_at',
      'updated_at',
    ]) {
      assert.match(conflictClause, new RegExp(`${column} = excluded\\.${column}`))
    }
  })

  it('preserves existing workflow audit entries when current data is re-imported', () => {
    assert.doesNotMatch(importSql, /delete\s+from\s+public\.order_history/i)
    assert.match(
      importSql,
      /where not exists \(\s*select 1\s+from public\.order_history existing_history/i,
    )
  })
})

function getCreateTableBlock({ sql, tableName }) {
  const match = sql.match(
    new RegExp(`create table if not exists public\\.${tableName} \\([\\s\\S]+?\\n\\);`),
  )

  assert.ok(match, `Expected public.${tableName} create table statement`)

  return match[0]
}

function getConflictClause({ columnName, sql }) {
  const match = sql.match(new RegExp(`on conflict \\(${columnName}\\)[\\s\\S]+?;`))

  assert.ok(match, `Expected on conflict (${columnName}) clause`)

  return match[0]
}

function readProjectFile(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}
