import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ROLE } from '../src/roleAccess.js'
import {
  createSessionRepository,
  mapProfileRow,
} from '../src/sessionRepository.js'

describe('mapProfileRow', () => {
  it('maps a Supabase profile row into the app Profile shape', () => {
    assert.deepEqual(
      mapProfileRow({
        display_name: 'Ali',
        role: 'Technician',
        technician_id: 'ali',
        user_id: 'user-1',
      }),
      {
        displayName: 'Ali',
        role: ROLE.TECHNICIAN,
        technicianId: 'ali',
        userId: 'user-1',
      },
    )
  })
})

describe('createSessionRepository', () => {
  it('returns null when there is no logged-in Supabase user', async () => {
    const repository = createSessionRepository({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    })

    assert.equal(await repository.getCurrentProfile(), null)
  })

  it('loads the logged-in user profile from Supabase profiles', async () => {
    const selectedTables = []
    const repository = createSessionRepository({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from(table) {
        selectedTables.push(table)
        return {
          select(columns) {
            assert.equal(columns, 'user_id, display_name, role, technician_id')
            return {
              eq(column, value) {
                assert.equal(column, 'user_id')
                assert.equal(value, 'user-1')
                return {
                  single: async () => ({
                    data: {
                      display_name: 'Manager',
                      role: 'Manager',
                      technician_id: null,
                      user_id: 'user-1',
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      },
    })

    assert.deepEqual(await repository.getCurrentProfile(), {
      displayName: 'Manager',
      role: ROLE.MANAGER,
      technicianId: null,
      userId: 'user-1',
    })
    assert.deepEqual(selectedTables, ['profiles'])
  })
  it('signs in with Supabase Auth and returns the matching profile', async () => {
    const repository = createSessionRepository({
      auth: {
        signInWithPassword: async (credentials) => {
          assert.deepEqual(credentials, {
            email: 'manager@example.com',
            password: 'secret-password',
          })
          return {
            data: { user: { id: 'manager-user' } },
            error: null,
          }
        },
      },
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: {
                      display_name: 'Manager',
                      role: 'Manager',
                      technician_id: null,
                      user_id: 'manager-user',
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      },
    })

    assert.deepEqual(
      await repository.signInWithPassword({
        email: 'manager@example.com',
        password: 'secret-password',
      }),
      {
        displayName: 'Manager',
        role: ROLE.MANAGER,
        technicianId: null,
        userId: 'manager-user',
      },
    )
  })

  it('signs out through Supabase Auth', async () => {
    let signedOut = false
    const repository = createSessionRepository({
      auth: {
        signOut: async () => {
          signedOut = true
          return { error: null }
        },
      },
    })

    await repository.signOut()

    assert.equal(signedOut, true)
  })
})

