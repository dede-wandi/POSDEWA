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

    const initialBal = Number(walletData.balance) || 0;

    // Buat wallet baru dengan saldo awal 0 terlebih dahulu jika ada initial balance
    // agar saldo awalnya dicatat secara transparan di tabel ledger wallet_transactions
    const { data: newWallet, error } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: walletData.user_id,
          name: walletData.name,
          type: walletData.type, // 'CASH', 'BANK', 'APP_BALANCE', 'PROFIT'
          balance: initialBal > 0 ? 0 : 0,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Jika ada saldo awal, catat sebagai mutasi masuk pertama (Saldo Awal)
    if (initialBal > 0 && newWallet?.id) {
      await addWalletTransaction({
        wallet_id: newWallet.id,
        type: 'IN',
        amount: initialBal,
        reference_type: 'ADJUSTMENT',
        description: 'Saldo Awal Dompet',
        balance_before: 0,
        balance_after: initialBal,
      });

      // Pastikan saldo di wallets terisi (fallback bila trigger DB belum terpasang)
      await supabase
        .from('wallets')
        .update({ balance: initialBal })
        .eq('id', newWallet.id);

      newWallet.balance = initialBal;
    }

    return { data: newWallet, error: null };
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
    const payload = {
      wallet_id: transactionData.wallet_id,
      type: transactionData.type, // 'IN' atau 'OUT'
      amount: transactionData.amount,
      reference_type: transactionData.reference_type || 'ADJUSTMENT', 
      reference_id: transactionData.reference_id || null,
      description: transactionData.description || '',
    };
    if (transactionData.balance_before !== undefined) {
      payload.balance_before = transactionData.balance_before;
    }
    if (transactionData.balance_after !== undefined) {
      payload.balance_after = transactionData.balance_after;
    }
    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert([payload])
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
    const toName = mutationData.to_wallet_name ? ` ke ${mutationData.to_wallet_name}` : '';
    const { error: outError } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: mutationData.from_wallet_id,
          type: 'OUT',
          amount: mutationData.amount + (mutationData.admin_fee || 0),
          reference_type: 'MUTATION',
          reference_id: mutation.id,
          description: `Mutasi Keluar${toName}: ${mutationData.description}`,
        }
      ]);
    
    if (outError) throw outError;

    // 3. Catat 'IN' ke dompet tujuan
    const fromName = mutationData.from_wallet_name ? ` dari ${mutationData.from_wallet_name}` : '';
    const { error: inError } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: mutationData.to_wallet_id,
          type: 'IN',
          amount: mutationData.amount,
          reference_type: 'MUTATION',
          reference_id: mutation.id,
          description: `Mutasi Masuk${fromName}: ${mutationData.description}`,
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

// Rekonsiliasi & Sinkronisasi Saldo Dompet dengan Total Transaksi Riwayat
export const syncWalletBalanceWithTransactions = async (walletId) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { data: null, calculatedBalance: 0, error: 'Supabase tidak tersedia' };

    // Ambil semua transaksi dompet ini
    const { data: txs, error: txError } = await supabase
      .from('wallet_transactions')
      .select('type, amount')
      .eq('wallet_id', walletId);

    if (txError) throw txError;

    const sumIn = (txs || []).filter(t => t.type === 'IN').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const sumOut = (txs || []).filter(t => t.type === 'OUT').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const calculatedBalance = sumIn - sumOut;

    // Update tabel wallets agar saldonya sesuai dengan riwayat
    const { data, error: updateError } = await supabase
      .from('wallets')
      .update({ balance: calculatedBalance, updated_at: new Date().toISOString() })
      .eq('id', walletId)
      .select()
      .single();

    if (updateError) throw updateError;
    return { data, calculatedBalance, error: null };
  } catch (err) {
    console.error('Error syncing wallet balance:', err);
    return { data: null, calculatedBalance: 0, error: err };
  }
};

// Sinkronkan SEMUA dompet user dengan total transaksi riwayat masing-masing
export const syncAllWalletsWithTransactions = async (userId) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { count: 0, error: 'Supabase tidak tersedia' };

    const { data: userWallets, error: wError } = await supabase
      .from('wallets')
      .select('id, name')
      .eq('user_id', userId);

    if (wError) throw wError;
    if (!userWallets || userWallets.length === 0) return { count: 0, error: null };

    let syncedCount = 0;
    for (const w of userWallets) {
      await syncWalletBalanceWithTransactions(w.id);
      syncedCount++;
    }

    return { count: syncedCount, error: null };
  } catch (err) {
    console.error('Error syncing all wallets:', err);
    return { count: 0, error: err };
  }
};

// Setel saldo dompet ke nilai riil secara langsung (menghasilkan transaksi penyesuaian di ledger)
export const setWalletDirectBalance = async (walletId, targetBalance, description = 'Koreksi Saldo Riil') => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

    // 1. Ambil saldo saat ini
    const { data: currentWallet, error: fetchErr } = await supabase
      .from('wallets')
      .select('balance, name')
      .eq('id', walletId)
      .single();

    if (fetchErr) throw fetchErr;

    const currentBal = Number(currentWallet?.balance) || 0;
    const targetBal = Number(targetBalance) || 0;
    const diff = targetBal - currentBal;

    if (Math.abs(diff) < 0.01) {
      return { success: true, message: 'Saldo sudah sesuai', balance: targetBal };
    }

    const adjType = diff > 0 ? 'IN' : 'OUT';
    const adjAmount = Math.abs(diff);

    // 2. Tambah transaksi penyesuaian agar tercatat transparan di buku besar
    const { error: txErr } = await addWalletTransaction({
      wallet_id: walletId,
      type: adjType,
      amount: adjAmount,
      reference_type: 'ADJUSTMENT',
      description: `${description} (Penyesuaian nilai riil dari ${currentBal} ke ${targetBal})`,
      balance_before: currentBal,
      balance_after: targetBal,
    });

    if (txErr) throw txErr;

    // 3. Pastikan saldo dompet terupdate
    await supabase
      .from('wallets')
      .update({ balance: targetBal, updated_at: new Date().toISOString() })
      .eq('id', walletId);

    return { success: true, balance: targetBal, diff, error: null };
  } catch (err) {
    console.error('Error setting direct wallet balance:', err);
    return { success: false, error: err };
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
