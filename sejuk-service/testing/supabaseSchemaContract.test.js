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
      'created_by',
      'updated_by',
      'reviewed_by',
      'closed_by',
      'updated_at',
    ]) {
      assert.match(conflictClause, new RegExp(`${column} = excluded\\.${column}`))
    }
  })

  it('imports current data with workflow actors for order rows and history rows', () => {
    assert.match(importSql, /insert into public\.profiles \(user_id, display_name, role, technician_id/)
    assert.match(importSql, /created_by,\s+updated_by,\s+reviewed_by,\s+closed_by/)
    assert.match(importSql, /insert into public\.order_history \(order_id, actor_user_id, actor_label, action/)
    assert.doesNotMatch(importSql, /insert into public\.order_history \(order_id, actor_label, action/)

    for (const userId of [
      '38071c75-8d3a-436f-90f2-782c984e3a59',
      '69b84337-fe44-407d-87fe-e42b30bc3b42',
      '8e968caa-6142-4088-83e3-269877c0c9bc',
      '978efebe-ac99-48c3-af3a-0289a3c9c15b',
      'aa6b7116-b1d4-43cc-95cd-41c702456b0a',
      'bc36dc29-ff9f-4841-85d2-d0900490e6f1',
    ]) {
      assert.match(importSql, new RegExp(`${userId}'::uuid|${userId}',`))
    }
  })

  it('preserves existing workflow audit entries when current data is re-imported', () => {
    assert.doesNotMatch(importSql, /delete\s+from\s+public\.order_history/i)
    assert.match(
      importSql,
      /where not exists \(\s*select 1\s+from public\.order_history existing_history/i,
    )
    assert.match(importSql, /existing_history\.actor_user_id = history\.actor_user_id/)
  })

  it('binds application roles to invited Supabase Auth users', () => {
    const profilesTable = getCreateTableBlock({ sql: schemaSql, tableName: 'profiles' })

    assert.match(
      profilesTable,
      /user_id uuid primary key references auth\.users\(id\) on delete cascade/,
    )
    assert.match(
      profilesTable,
      /role text not null check \(role in \('Admin', 'Technician', 'Manager'\)\)/,
    )
    assert.match(
      profilesTable,
      /constraint technician_role_requires_technician[\s\S]+role = 'Technician' and technician_id is not null/,
    )
    assert.doesNotMatch(schemaSql, /grant[\s\S]+to anon\b/i)
    assert.doesNotMatch(schemaSql, /\bsign_up\b|\bsignup\b|signUp/)
  })

  it('keeps order authorization bound to Supabase RLS policies by role', () => {
    assert.match(
      schemaSql,
      /create policy "orders role based read"[\s\S]+current_app_role\(\) in \('Admin', 'Manager'\)[\s\S]+current_app_role\(\) = 'Technician'[\s\S]+assigned_technician_id = public\.current_technician_id\(\)/,
    )
    assert.match(
      schemaSql,
      /create policy "orders admin insert"[\s\S]+current_app_role\(\) = 'Admin'[\s\S]+created_by = auth\.uid\(\)/,
    )
    assert.match(
      schemaSql,
      /create policy "orders technician complete assigned"[\s\S]+current_app_role\(\) = 'Technician'[\s\S]+assigned_technician_id = public\.current_technician_id\(\)/,
    )
    assert.match(
      schemaSql,
      /create policy "orders manager review close"[\s\S]+current_app_role\(\) = 'Manager'/,
    )
    assert.match(
      schemaSql,
      /raise exception 'Admins can only update order intake details'/,
    )
    assert.match(
      schemaSql,
      /raise exception 'Technicians can only complete their assigned orders'/,
    )
    assert.match(
      schemaSql,
      /raise exception 'Managers can only review or close completed orders'/,
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
