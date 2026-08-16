import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTechnicianRepository } from './technicianRepository.js'

describe('createTechnicianRepository', () => {
  it('loads active technicians from Supabase technicians rows', async () => {
    const calls = []
    const repository = createTechnicianRepository({
      from(table) {
        calls.push(['from', table])
        return {
          select(columns) {
            calls.push(['select', columns])
            return {
              eq(column, value) {
                calls.push(['eq', column, value])
                return {
                  order(columnName, options) {
                    calls.push(['order', columnName, options])
                    return {
                      data: [
                        {
                          branch: 'Shah Alam',
                          id: 'ali',
                          is_active: true,
                          name: 'Ali',
                        },
                      ],
                      error: null,
                    }
                  },
                }
              },
            }
          },
        }
      },
    })

    assert.deepEqual(await repository.listTechnicians(), [
      { branch: 'Shah Alam', id: 'ali', name: 'Ali' },
    ])
    assert.deepEqual(calls, [
      ['from', 'technicians'],
      ['select', 'id, name, branch, is_active'],
      ['eq', 'is_active', true],
      ['order', 'name', { ascending: true }],
    ])
  })
})
