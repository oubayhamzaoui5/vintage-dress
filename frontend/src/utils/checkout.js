export function afterLogin(type, state) {
  if (type === 'admin') return '/admin'
  return ['/commande', '/boutique'].includes(state?.from) || /^\/commandes\/[1-9]\d*$/.test(state?.from || '') ? state.from : '/compte'
}
export const money = (amount) => `${Number(amount).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`
