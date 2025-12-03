export function formatIDR(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

// Alias untuk backward compatibility
export const formatCurrency = formatIDR;