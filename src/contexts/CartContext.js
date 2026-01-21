import React, { createContext, useContext, useState, useMemo } from 'react';
import { Alert } from 'react-native';
import { useToast } from './ToastContext';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const { showToast } = useToast();

  const addToCart = (product, quantity = 1) => {
    const availableStock = Number(product.stock || 0);

    // Cek jika yang diminta langsung melebihi stok
    if (quantity > availableStock) {
      showToast(`Stok tidak cukup. Hanya tersedia ${availableStock} unit.`, 'error');
      return;
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newTotal = existing.quantity + quantity;
        if (newTotal > availableStock) {
          showToast(`Stok terbatas. Total di keranjang akan melebihi stok (${availableStock}).`, 'error');
          return prev;
        }
        showToast('Berhasil ditambahkan ke keranjang', 'success');
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newTotal }
            : item
        );
      }
      showToast('Berhasil ditambahkan ke keranjang', 'success');
      return [...prev, { product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prev) => {
      const targetItem = prev.find((item) => item.product.id === productId);
      if (targetItem) {
        const availableStock = Number(targetItem.product.stock || 0);
        if (quantity > availableStock) {
           showToast(`Maksimal pembelian ${availableStock} unit.`, 'error');
           return prev.map((item) => 
             item.product.id === productId ? { ...item, quantity: availableStock } : item
           );
        }
      }
      
      return prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.product.price) || 0) * item.quantity, 0);
  }, [items]);

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
