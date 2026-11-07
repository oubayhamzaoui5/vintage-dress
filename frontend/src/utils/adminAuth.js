export { getAdmin, logout as adminLogout } from './session.js'

// Display permissions only; API checks the current database role on every request.
export const can = (admin, action) => {
  const rights = {
    principal: ['stats', 'products:read', 'products:write', 'orders', 'users', 'admins:create', 'categories', 'messages', 'settings'],
    secondaire: ['stats', 'products:read', 'orders', 'messages'],
  }
  return !!admin && rights[admin.role]?.includes(action)
}
