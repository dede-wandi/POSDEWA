-- 1. Update fungsi rekap agar hanya mengambil profit dari hari-hari SEBELUM hari ini
CREATE OR REPLACE FUNCTION get_unsynced_profits(p_user_id UUID)
RETURNS TABLE (
    tanggal TEXT,
    total_transaksi BIGINT,
    total_profit BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(DATE(created_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS tanggal,
        COUNT(id)::BIGINT AS total_transaksi,
        COALESCE(SUM(profit), 0)::BIGINT AS total_profit
    FROM public.sales
    WHERE user_id = p_user_id
      AND is_profit_synced = false
      AND profit > 0
      -- FILTER HARI INI TIDAK IKUT
      AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < DATE(NOW() AT TIME ZONE 'Asia/Jakarta')
    GROUP BY DATE(created_at AT TIME ZONE 'Asia/Jakarta')
    ORDER BY tanggal ASC;
END;
$$ LANGUAGE plpgsql;

-- 2. Update fungsi eksekusi tarik profit agar HANYA menarik profit SEBELUM hari ini
CREATE OR REPLACE FUNCTION manual_sync_pending_profits(p_user_id UUID, p_cash_wallet_id UUID, p_profit_wallet_id UUID)
RETURNS json AS $$
DECLARE
    v_total_profit BIGINT;
    v_total_trx INT;
    v_mutation_id UUID;
BEGIN
    -- Hitung total profit yang belum ditarik (Hanya sebelum hari ini)
    SELECT COALESCE(SUM(profit), 0), COUNT(id)
    INTO v_total_profit, v_total_trx
    FROM public.sales
    WHERE user_id = p_user_id 
      AND is_profit_synced = false 
      AND profit > 0
      AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < DATE(NOW() AT TIME ZONE 'Asia/Jakarta');

    IF v_total_profit > 0 THEN
        -- Catat Mutasi
        INSERT INTO public.wallet_mutations (from_wallet_id, to_wallet_id, amount, description)
        VALUES (p_cash_wallet_id, p_profit_wallet_id, v_total_profit, 'Tarik Profit Manual (' || v_total_trx || ' trx)')
        RETURNING id INTO v_mutation_id;
        
        -- Tarik dari Kasir
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, reference_type, reference_id, description)
        VALUES (p_cash_wallet_id, 'OUT', v_total_profit, 'MUTATION', v_mutation_id, 'Tarik Laba (' || v_total_trx || ' trx)');

        -- Masukkan ke Profit
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, reference_type, reference_id, description)
        VALUES (p_profit_wallet_id, 'IN', v_total_profit, 'MUTATION', v_mutation_id, 'Simpan Laba (' || v_total_trx || ' trx)');

        -- Tandai transaksi sebagai sudah ditarik (Hanya sebelum hari ini)
        UPDATE public.sales
        SET is_profit_synced = true
        WHERE user_id = p_user_id 
          AND is_profit_synced = false 
          AND profit > 0
          AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < DATE(NOW() AT TIME ZONE 'Asia/Jakarta');

        RETURN json_build_object('success', true, 'synced_amount', v_total_profit, 'synced_trx', v_total_trx);
    ELSE
        RETURN json_build_object('success', false, 'message', 'Tidak ada profit yang bisa ditarik');
    END IF;
END;
$$ LANGUAGE plpgsql;
