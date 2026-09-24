/**
 * Comandos del carrito desde la UI.
 *  - Cada mutation devuelve el Cart actualizado: Apollo lo normaliza por id
 *    y todas las vistas que lo muestran (badge del header, página del
 *    carrito) se actualizan solas.
 *  - `update` escribe además Query.myCart, necesario cuando el carrito se
 *    acaba de crear y la raíz aún apuntaba a null.
 *  - Cambios de cantidad y eliminaciones usan optimisticResponse.
 */
import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { CartFieldsFragment, CartResultFieldsFragment } from '../gql/graphql';
import {
  AddItemToCartMutation,
  MyCartQuery,
  RemoveItemFromCartMutation,
  UpdateCartItemQuantityMutation,
} from '../graphql/operations';

function writeMyCart(cache: ApolloCache, result: CartResultFieldsFragment | undefined) {
  if (result?.__typename === 'CartPayload') {
    cache.writeQuery({ query: MyCartQuery, data: { myCart: result.cart } });
  }
}

/** Recalcula los totales para la respuesta optimista. */
function optimisticCart(cart: CartFieldsFragment, items: CartFieldsFragment['items']): CartFieldsFragment {
  return {
    ...cart,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
    requiresPrescription: items.some((i) => i.medication.requiresPrescription),
  };
}

export function useCartActions() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [addMutation, addState] = useMutation(AddItemToCartMutation, {
    update: (cache, { data }) => writeMyCart(cache, data?.addItemToCart),
  });
  const [updateMutation, updateState] = useMutation(UpdateCartItemQuantityMutation, {
    update: (cache, { data }) => writeMyCart(cache, data?.updateCartItemQuantity),
  });
  const [removeMutation, removeState] = useMutation(RemoveItemFromCartMutation, {
    update: (cache, { data }) => writeMyCart(cache, data?.removeItemFromCart),
  });

  function ensureLoggedIn(): boolean {
    if (isAuthenticated) return true;
    navigate(`/ingresar?next=${encodeURIComponent(location.pathname)}`);
    return false;
  }

  async function addItem(medicationId: string, quantity = 1) {
    if (!ensureLoggedIn()) return null;
    const { data } = await addMutation({ variables: { input: { medicationId, quantity } } });
    return data?.addItemToCart ?? null;
  }

  async function updateQuantity(cart: CartFieldsFragment, medicationId: string, quantity: number) {
    const items = cart.items.map((i) =>
      i.medication.id === medicationId ? { ...i, quantity, lineTotal: i.medication.price * quantity } : i,
    );
    const { data } = await updateMutation({
      variables: { input: { medicationId, quantity } },
      optimisticResponse: {
        updateCartItemQuantity: { __typename: 'CartPayload', cart: optimisticCart(cart, items) },
      },
    });
    return data?.updateCartItemQuantity ?? null;
  }

  async function removeItem(cart: CartFieldsFragment, medicationId: string) {
    const items = cart.items.filter((i) => i.medication.id !== medicationId);
    const { data } = await removeMutation({
      variables: { input: { medicationId } },
      optimisticResponse: {
        removeItemFromCart: { __typename: 'CartPayload', cart: optimisticCart(cart, items) },
      },
    });
    return data?.removeItemFromCart ?? null;
  }

  return {
    addItem,
    updateQuantity,
    removeItem,
    adding: addState.loading,
    updating: updateState.loading || removeState.loading,
  };
}
