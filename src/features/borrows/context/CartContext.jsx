import { createContext, useContext, useState } from 'react'
import toast from 'react-hot-toast'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([])

  const cartCount = cartItems.length

  function addToCart(component, quantity = 1) {
    if (cartCount >= 5) {
      toast.error('Cart is full (max 5 components)')
      return false
    }
    if (cartItems.some(item => item.component.id === component.id)) {
      toast.error('This component is already in your cart')
      return false
    }
    setCartItems(prev => [...prev, { component, quantity }])
    return true
  }

  function removeFromCart(componentId) {
    setCartItems(prev => prev.filter(item => item.component.id !== componentId))
  }

  function updateQuantity(componentId, quantity) {
    setCartItems(prev =>
      prev.map(item =>
        item.component.id === componentId ? { ...item, quantity } : item
      )
    )
  }

  function clearCart() {
    setCartItems([])
  }

  return (
    <CartContext.Provider value={{ cartItems, cartCount, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
