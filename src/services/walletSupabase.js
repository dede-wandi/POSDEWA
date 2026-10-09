import { getSupabaseClient } from './supabase';

// ================================
// WALLETS CRUD
// ================================

export const getWallets = async (userId) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    
    if (!userId) return { data: [], error: null };

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return { data: null, error };
  }
};

// Menambahkan wallet baru
export const addWallet = async (walletData) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    const { data, error } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: walletData.user_id,
          name: walletData.name,
          type: walletData.type, // 'CASH', 'BANK', 'APP_BALANCE'
          balance: walletData.balance || 0,
          is_active: true,
        },
      ])
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding wallet:', error);
    return { data: null, error };
  }
};

// Mengubah data wallet (nama / status aktif)
export const updateWallet = async (id, updateData) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    const { data, error } = await supabase
      .from('wallets')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating wallet:', error);
    return { data: null, error };
  }
};

// Menghapus wallet
export const deleteWallet = async (id) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    const { data, error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return { data: null, error };
  }
};


// ================================
// WALLET TRANSACTIONS (LEDGER)
// ================================

// Mencatat transaksi uang masuk/keluar ke wallet
export const addWalletTransaction = async (transactionData) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: transactionData.wallet_id,
          type: transactionData.type, // 'IN' atau 'OUT'
          amount: transactionData.amount,
          reference_type: transactionData.reference_type || 'ADJUSTMENT', 
          reference_id: transactionData.reference_id || null,
          description: transactionData.description || '',
        }
      ])
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding wallet transaction:', error);
    return { data: null, error };
  }
};

// ================================
// WALLET MUTATIONS (PINDAH SALDO)
// ================================

// Memindahkan saldo antar wallet (contoh: Setor tunai ke BCA)
export const transferBalance = async (mutationData) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    
    // 1. Catat ke tabel wallet_mutations
    const { data: mutation, error: mutationError } = await supabase
      .from('wallet_mutations')
      .insert([
        {
          from_wallet_id: mutationData.from_wallet_id,
          to_wallet_id: mutationData.to_wallet_id,
          amount: mutationData.amount,
          admin_fee: mutationData.admin_fee || 0,
          description: mutationData.description || 'Pindah Saldo',
        }
      ])
      .select()
      .single();

    if (mutationError) throw mutationError;

    // 2. Catat 'OUT' dari dompet asal
    const { error: outError } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: mutationData.from_wallet_id,
          type: 'OUT',
          amount: mutationData.amount + (mutationData.admin_fee || 0),
          reference_type: 'MUTATION',
          reference_id: mutation.id,
          description: `Mutasi Keluar ke Dompet Tujuan: ${mutationData.description}`,
        }
      ]);
    
    if (outError) throw outError;

    // 3. Catat 'IN' ke dompet tujuan
    const { error: inError } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: mutationData.to_wallet_id,
          type: 'IN',
          amount: mutationData.amount,
          reference_type: 'MUTATION',
          reference_id: mutation.id,
          description: `Mutasi Masuk dari Dompet Asal: ${mutationData.description}`,
        }
      ]);

    if (inError) throw inError;

    return { data: mutation, error: null };
  } catch (error) {
    console.error('Error transferring balance:', error);
    return { data: null, error };
  }
};

// Mengambil riwayat mutasi / ledger
export const getWalletTransactions = async (walletId) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { data: null, error };
  }
};

// ================================
// MANUAL PROFIT SYNC (NEW)
// ================================
export const getUnsyncedProfits = async (userId) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_unsynced_profits', {
      p_user_id: userId
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching unsynced profits:', error);
    return { data: null, error };
  }
};

export const syncPendingProfits = async (userId, cashWalletId, profitWalletId) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('manual_sync_pending_profits', {
      p_user_id: userId,
      p_cash_wallet_id: cashWalletId,
      p_profit_wallet_id: profitWalletId
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error syncing pending profits:', error);
    return { data: null, error };
  }
};
