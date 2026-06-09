import { getSupabaseClient } from './supabase';

// --- PERSONAL FINANCE SERVICES (Separated from Store) ---

// Get all personal accounts
export async function getPersonalAccounts() {
  
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) return { success: false, error: 'User tidak ter-autentikasi' };

    const { data, error } = await supabase
      .from('personal_accounts')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create new personal account
export async function createPersonalAccount(accountData) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) return { success: false, error: 'User tidak ter-autentikasi' };

    const { data, error } = await supabase
      .from('personal_accounts')
      .insert({
        owner_id: session.user.id,
        name: accountData.name,
        type: accountData.type,
        balance: accountData.initialBalance || 0,
        description: accountData.description
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update personal account
export async function updatePersonalAccount(id, updates) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { error } = await supabase
      .from('personal_accounts')
      .update(updates)
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete personal account
export async function deletePersonalAccount(id) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    // Soft delete
    const { error } = await supabase
      .from('personal_accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get personal transactions
export async function getPersonalTransactions(accountId = null, limit = 50, startDate = null, endDate = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) return { success: false, error: 'User tidak ter-autentikasi' };

    let query = supabase
      .from('personal_transactions')
      .select(`
        *,
        personal_accounts (
          name,
          type
        )
      `)
      .eq('owner_id', session.user.id)
      .order('transaction_date', { ascending: false }); // Order by transaction_date, not created_at

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    if (startDate && endDate) {
      // If date range is provided, use it and ignore limit (or make limit optional/larger)
      query = query
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
    } else {
      // Default behavior with limit
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Record personal transaction
export async function recordPersonalTransaction(data) {
  const { account_id, type, amount, category, description, transaction_date } = data;
  
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) return { success: false, error: 'User tidak ter-autentikasi' };

    // 1. Get current account balance
    const { data: account, error: accError } = await supabase
      .from('personal_accounts')
      .select('balance, name')
      .eq('id', account_id)
      .eq('owner_id', session.user.id)
      .single();

    if (accError || !account) return { success: false, error: 'Akun tidak ditemukan' };

    const oldBalance = Number(account.balance) || 0;
    const numAmount = Number(amount);
    
    // 2. Calculate new balance
    let newBalance = oldBalance;
    if (type === 'income') {
      newBalance += numAmount;
    } else {
      newBalance -= numAmount;
    }

    // 3. Update account balance
    const { error: updateError } = await supabase
      .from('personal_accounts')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', account_id);

    if (updateError) return { success: false, error: updateError.message };

    // 4. Create transaction record
    const { data: trx, error: trxError } = await supabase
      .from('personal_transactions')
      .insert({
        owner_id: session.user.id,
        account_id,
        type,
        amount: numAmount,
        category,
        description,
        transaction_date: transaction_date || new Date().toISOString()
      })
      .select()
      .single();

    if (trxError) return { success: false, error: trxError.message };

    return { success: true, data: trx };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update personal transaction
export async function updatePersonalTransaction(transactionId, updates) {
  
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) return { success: false, error: 'User tidak ter-autentikasi' };

    // 1. Get original transaction to revert balance
    const { data: originalTrx, error: trxError } = await supabase
      .from('personal_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('owner_id', session.user.id)
      .single();

    if (trxError || !originalTrx) return { success: false, error: 'Transaksi tidak ditemukan' };

    // 2. Get current account balance
    const { data: account, error: accError } = await supabase
      .from('personal_accounts')
      .select('balance')
      .eq('id', originalTrx.account_id)
      .eq('owner_id', session.user.id)
      .single();

    if (accError || !account) return { success: false, error: 'Akun tidak ditemukan' };

    let currentBalance = Number(account.balance) || 0;

    // 3. Revert original transaction effect
    if (originalTrx.type === 'income') {
      currentBalance -= Number(originalTrx.amount);
    } else {
      currentBalance += Number(originalTrx.amount);
    }

    // 4. Apply new transaction effect (if amount or type changed)
    const newType = updates.type || originalTrx.type;
    const newAmount = updates.amount !== undefined ? Number(updates.amount) : Number(originalTrx.amount);

    if (newType === 'income') {
      currentBalance += newAmount;
    } else {
      currentBalance -= newAmount;
    }

    // 5. Update account balance
    const { error: updateBalanceError } = await supabase
      .from('personal_accounts')
      .update({ 
        balance: currentBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', originalTrx.account_id);

    if (updateBalanceError) return { success: false, error: updateBalanceError.message };

    // 6. Update transaction record
    const { data: updatedTrx, error: updateTrxError } = await supabase
      .from('personal_transactions')
      .update({
        ...updates,
        amount: newAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .eq('owner_id', session.user.id)
      .select()
      .single();

    if (updateTrxError) return { success: false, error: updateTrxError.message };

    return { success: true, data: updatedTrx };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete personal transaction
export async function deletePersonalTransaction(transactionId) {
  
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) return { success: false, error: 'User tidak ter-autentikasi' };

    // 1. Get transaction to revert balance
    const { data: trx, error: trxError } = await supabase
      .from('personal_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('owner_id', session.user.id)
      .single();

    if (trxError || !trx) {
      return { success: false, error: 'Transaksi tidak ditemukan' };
    }

    // 2. If transaction has an account, try to revert balance
    if (trx.account_id) {
      const { data: account, error: accError } = await supabase
        .from('personal_accounts')
        .select('balance')
        .eq('id', trx.account_id)
        .eq('owner_id', session.user.id)
        .single();

      if (accError || !account) {
        // If account not found, we cannot revert balance.
        // For data integrity regarding "pastikan saldo kembali", we should probably stop.
        return { success: false, error: 'Akun terkait tidak ditemukan. Saldo tidak dapat dikembalikan.' };
      }

      let currentBalance = Number(account.balance) || 0;
      const amountToRevert = Number(trx.amount) || 0;

      // 3. Revert transaction effect
      if (trx.type === 'income') {
        currentBalance -= amountToRevert;
      } else {
        currentBalance += amountToRevert;
      }

      // 4. Update account balance
      const { error: updateBalanceError } = await supabase
        .from('personal_accounts')
        .update({ 
          balance: currentBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', trx.account_id);

      if (updateBalanceError) {
        return { success: false, error: 'Gagal mengupdate saldo: ' + updateBalanceError.message };
      }
    }

    // 5. Delete transaction record
    const { error: deleteError } = await supabase
      .from('personal_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('owner_id', session.user.id);

    if (deleteError) {
      return { success: false, error: 'Gagal menghapus transaksi: ' + deleteError.message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// --- STORE FINANCE SERVICES (For Store Operations) ---

// Get all payment channels for current user
export async function getPaymentChannels() {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    const { data, error } = await supabase
      .from('payment_channels')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create new payment channel
export async function createPaymentChannel(channelData) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    const { data, error } = await supabase
      .from('payment_channels')
      .insert({
        owner_id: session.user.id,
        name: channelData.name,
        type: channelData.type || 'digital',
        balance: channelData.initialBalance || 0,
        initial_balance: channelData.initialBalance || 0,
        description: channelData.description
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // If initial balance > 0, create initial transaction
    if (channelData.initialBalance > 0) {
      await createFinanceTransaction({
        payment_channel_id: data.id,
        type: 'income',
        amount: channelData.initialBalance,
        previous_balance: 0,
        new_balance: channelData.initialBalance,
        description: 'Modal awal',
        reference_type: 'initial'
      });
    }

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update payment channel
export async function updatePaymentChannel(channelId, updateData) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    const { data, error } = await supabase
      .from('payment_channels')
      .update({
        name: updateData.name,
        type: updateData.type,
        description: updateData.description,
        balance: updateData.balance,
        updated_at: new Date().toISOString()
      })
      .eq('id', channelId)
      .eq('owner_id', session.user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete payment channel
export async function deletePaymentChannel(channelId) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    // Check if channel has balance
    const { data: channel } = await supabase
      .from('payment_channels')
      .select('balance, name')
      .eq('id', channelId)
      .eq('owner_id', session.user.id)
      .single();

    if (channel && channel.balance > 0) {
      return { success: false, error: `Channel ${channel.name} masih memiliki saldo. Kosongkan saldo terlebih dahulu.` };
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('payment_channels')
      .update({ is_active: false })
      .eq('id', channelId)
      .eq('owner_id', session.user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Record a manual transaction (Income/Expense)
export async function recordTransaction(data) {
  const { channel_id, type, amount, category, description, transaction_date } = data;
  
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session || !session.user) return { success: false, error: 'User tidak ter-autentikasi' };

    // 1. Get current channel balance
    const { data: channel, error: channelError } = await supabase
      .from('payment_channels')
      .select('balance, name')
      .eq('id', channel_id)
      .eq('owner_id', session.user.id)
      .single();

    if (channelError || !channel) return { success: false, error: 'Channel tidak ditemukan' };

    const oldBalance = Number(channel.balance) || 0;
    const numAmount = Number(amount);
    
    // 2. Calculate new balance
    let newBalance = oldBalance;
    if (type === 'income') {
      newBalance += numAmount;
    } else {
      newBalance -= numAmount;
    }

    // 3. Update channel balance
    const { error: updateError } = await supabase
      .from('payment_channels')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', channel_id);

    if (updateError) return { success: false, error: updateError.message };

    // 4. Create transaction record
    const { data: trx, error: trxError } = await supabase
      .from('finance_transactions')
      .insert({
        owner_id: session.user.id,
        channel_id,
        type,
        amount: numAmount,
        category,
        description,
        transaction_date: transaction_date || new Date().toISOString()
      })
      .select()
      .single();

    if (trxError) return { success: false, error: trxError.message };

    return { success: true, data: trx };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create finance transaction
export async function createFinanceTransaction(transactionData) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    const { data, error } = await supabase
      .from('finance_transactions')
      .insert({
        owner_id: session.user.id,
        ...transactionData
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get finance transactions for a channel (or all if channelId is null)
export async function getFinanceTransactions(channelId = null, limit = 50) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    let query = supabase
      .from('finance_transactions')
      .select(`
        *,
        payment_channels (
          name,
          type
        )
      `)
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process payment for sale
export async function processPayment(channelId, amount, saleId) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    // Get current channel balance
    const { data: channel, error: channelError } = await supabase
      .from('payment_channels')
      .select('balance, name, type')
      .eq('id', channelId)
      .eq('owner_id', session.user.id)
      .single();

    if (channelError) {
      return { success: false, error: channelError.message };
    }

    // For non-cash channels, check if balance is sufficient
    if (channel.type !== 'cash' && channel.balance < amount) {
      return { success: false, error: `Saldo ${channel.name} tidak mencukupi. Saldo: ${channel.balance}, Dibutuhkan: ${amount}` };
    }

    const previousBalance = channel.balance;
    const newBalance = channel.type === 'cash' ? previousBalance + amount : previousBalance - amount;

    // Create transaction record
    const transactionResult = await createFinanceTransaction({
      payment_channel_id: channelId,
      type: channel.type === 'cash' ? 'income' : 'expense',
      amount: amount,
      previous_balance: previousBalance,
      new_balance: newBalance,
      description: `Pembayaran penjualan`,
      reference_type: 'sale',
      reference_id: saleId
    });

    if (!transactionResult.success) {
      return transactionResult;
    }

    return { success: true, data: { newBalance, transaction: transactionResult.data } };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Adjust channel balance
export async function adjustChannelBalance(channelId, newBalance, reason) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    // First, get the current channel data
    const { data: channelData, error: channelError } = await supabase
      .from('payment_channels')
      .select('*')
      .eq('id', channelId)
      .eq('owner_id', session.user.id)
      .single();

    if (channelError || !channelData) {
      return { success: false, error: 'Channel tidak ditemukan' };
    }

    const oldBalance = channelData.balance || 0;
    const adjustmentAmount = newBalance - oldBalance;

    // Update the channel balance
    const { error: updateError } = await supabase
      .from('payment_channels')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', channelId)
      .eq('owner_id', session.user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Create a transaction record for the adjustment
    const transactionData = {
      channel_id: channelId,
      amount: Math.abs(adjustmentAmount),
      transaction_type: adjustmentAmount >= 0 ? 'adjustment_in' : 'adjustment_out',
      description: reason || 'Penyesuaian saldo',
      created_at: new Date().toISOString()
    };

    const { error: transactionError } = await supabase
      .from('finance_transactions')
      .insert([transactionData]);

    if (transactionError) {
      // Don't return error here as the balance was already updated
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get transaction report data with payment channel analysis
export async function getTransactionReport(userId, dateRange = null) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { 
      success: false, 
      error: 'Supabase tidak tersedia',
      channelData: [],
      totalTransactions: 0,
      totalAmount: 0,
      topChannel: null
    };
  }

  try {
    let query = supabase
      .from('finance_transactions')
      .select(`
        *,
        payment_channels:payment_channel_id (
          id,
          name,
          type
        )
      `)
      .eq('owner_id', userId)
      .eq('reference_type', 'sale');

    // Apply date filter if provided
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      query = query
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString());
    }

    const { data: transactionData, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return { 
        success: false, 
        error: error.message,
        channelData: [],
        totalTransactions: 0,
        totalAmount: 0,
        topChannel: null
      };
    }

    // Handle case where no transactions are found
    if (!transactionData || transactionData.length === 0) {
      return {
        success: true,
        channelData: [],
        totalTransactions: 0,
        totalAmount: 0,
        topChannel: null
      };
    }

    // Process the data to create channel analysis
    const channelStats = {};
    let totalTransactions = 0;
    let totalAmount = 0;

    transactionData.forEach(transaction => {
      if (transaction && transaction.payment_channels) {
        const channelId = transaction.payment_channels.id;
        const channelName = transaction.payment_channels.name;
        const channelType = transaction.payment_channels.type;
        const amount = parseFloat(transaction.amount) || 0;

        if (!channelStats[channelId]) {
          channelStats[channelId] = {
            channel_id: channelId,
            channel_name: channelName,
            channel_type: channelType,
            transaction_count: 0,
            total_amount: 0
          };
        }

        channelStats[channelId].transaction_count += 1;
        channelStats[channelId].total_amount += amount;
        
        totalTransactions += 1;
        totalAmount += amount;
      }
    });

    // Convert to array and sort by total amount (descending)
    const channelData = Object.values(channelStats)
      .sort((a, b) => b.total_amount - a.total_amount);

    // Find top channel
    const topChannel = channelData.length > 0 ? channelData[0] : null;

    return {
      success: true,
      channelData,
      totalTransactions,
      totalAmount,
      topChannel
    };

  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      channelData: [],
      totalTransactions: 0,
      totalAmount: 0,
      topChannel: null
    };
  }
}
