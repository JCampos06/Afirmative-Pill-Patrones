/**
 * Operaciones GraphQL del cliente. Cada vista pide EXACTAMENTE los campos
 * que pinta (selección selectiva → sin over-fetching). Los tipos TypeScript
 * se generan con `npm run codegen` a partir de backend/schema.graphql.
 */
import { graphql } from '../gql';

// ─── Fragmentos ───────────────────────────────────────────────────────

/** Vista condensada del catálogo: pensada para redes móviles. */
export const MedicationCardFields = graphql(`
  fragment MedicationCardFields on Medication {
    id
    name
    presentation
    dosage
    price
    requiresPrescription
    availability {
      status
    }
  }
`);

export const CartFields = graphql(`
  fragment CartFields on Cart {
    id
    status
    itemCount
    subtotal
    requiresPrescription
    updatedAt
    items {
      id
      quantity
      lineTotal
      medication {
        id
        name
        presentation
        price
        requiresPrescription
        availability {
          status
          unitsAvailable
        }
      }
    }
  }
`);

/** Resultado de cualquier comando del carrito (unión tipada). */
export const CartResultFields = graphql(`
  fragment CartResultFields on CartResult {
    __typename
    ... on CartPayload {
      cart {
        ...CartFields
      }
    }
    ... on DomainError {
      code
      message
    }
    ... on ValidationError {
      fieldErrors {
        field
        message
      }
    }
    ... on InsufficientStockError {
      shortages {
        requested
        available
        medication {
          id
          name
        }
      }
    }
  }
`);

export const OrderSummaryFields = graphql(`
  fragment OrderSummaryFields on OrderSummary {
    id
    code
    status
    total
    itemCount
    requiresPrescription
    customerName
    shippingAddress
    placedAt
    updatedAt
    projectionVersion
    syncedAt
    items {
      medicationId
      sku
      name
      quantity
      unitPrice
      subtotal
      requiresPrescription
    }
    prescription {
      status
      doctorName
      doctorLicense
      patientDocument
      issuedAt
      documentUrl
      reviewNotes
      reviewedAt
    }
    statusHistory {
      status
      at
      note
      actor
    }
  }
`);

export const OrderCommandResultFields = graphql(`
  fragment OrderCommandResultFields on OrderCommandResult {
    __typename
    ... on OrderCommandPayload {
      receipt {
        orderId
        code
        status
        acceptedAt
      }
    }
    ... on DomainError {
      code
      message
    }
    ... on ValidationError {
      fieldErrors {
        field
        message
      }
    }
  }
`);

// ─── Catálogo (read model) ────────────────────────────────────────────

export const CatalogQuery = graphql(`
  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {
    medications(filter: $filter, sort: $sort, first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          ...MedicationCardFields
        }
      }
    }
  }
`);

export const CategoriesQuery = graphql(`
  query Categories {
    categories {
      id
      name
      medicationCount
    }
  }
`);

/** Ficha detallada: aquí sí se piden laboratorio, indicaciones, etc. */
export const MedicationDetailQuery = graphql(`
  query MedicationDetail($id: ID!) {
    medication(id: $id) {
      id
      sku
      name
      activeIngredient
      dosage
      presentation
      price
      requiresPrescription
      description
      category {
        id
        name
      }
      laboratory {
        id
        name
      }
      availability {
        status
        unitsAvailable
        syncedAt
      }
    }
  }
`);

// ─── Autenticación ────────────────────────────────────────────────────

export const MeQuery = graphql(`
  query Me {
    me {
      id
      email
      fullName
      documentNumber
      role
    }
  }
`);

export const LoginMutation = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      __typename
      ... on AuthPayload {
        token
        user {
          id
          fullName
          role
        }
      }
      ... on DomainError {
        code
        message
      }
    }
  }
`);

export const RegisterMutation = graphql(`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      __typename
      ... on AuthPayload {
        token
        user {
          id
          fullName
          role
        }
      }
      ... on DomainError {
        code
        message
      }
      ... on ValidationError {
        fieldErrors {
          field
          message
        }
      }
    }
  }
`);

// ─── Carrito (comandos) ───────────────────────────────────────────────

export const MyCartQuery = graphql(`
  query MyCart {
    myCart {
      ...CartFields
    }
  }
`);

export const AddItemToCartMutation = graphql(`
  mutation AddItemToCart($input: AddItemToCartInput!) {
    addItemToCart(input: $input) {
      ...CartResultFields
    }
  }
`);

export const UpdateCartItemQuantityMutation = graphql(`
  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {
    updateCartItemQuantity(input: $input) {
      ...CartResultFields
    }
  }
`);

export const RemoveItemFromCartMutation = graphql(`
  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {
    removeItemFromCart(input: $input) {
      ...CartResultFields
    }
  }
`);

// ─── Órdenes ──────────────────────────────────────────────────────────

export const PlaceOrderMutation = graphql(`
  mutation PlaceOrder($input: PlaceOrderInput!) {
    placeOrder(input: $input) {
      __typename
      ... on PlaceOrderPayload {
        receipt {
          orderId
          code
          status
          total
          requiresPrescription
          acceptedAt
        }
      }
      ... on DomainError {
        code
        message
      }
      ... on ValidationError {
        fieldErrors {
          field
          message
        }
      }
      ... on PrescriptionRequiredError {
        medications {
          id
          name
        }
      }
      ... on InsufficientStockError {
        shortages {
          requested
          available
          medication {
            id
            name
          }
        }
      }
    }
  }
`);

export const MyOrdersQuery = graphql(`
  query MyOrders {
    myOrders {
      id
      code
      status
      total
      itemCount
      requiresPrescription
      placedAt
    }
  }
`);

export const OrderQuery = graphql(`
  query Order($id: ID!) {
    order(id: $id) {
      ...OrderSummaryFields
    }
  }
`);

export const OrderStatusChangedSubscription = graphql(`
  subscription OrderStatusChanged($orderId: ID!) {
    orderStatusChanged(orderId: $orderId) {
      ...OrderSummaryFields
    }
  }
`);

export const CancelOrderMutation = graphql(`
  mutation CancelOrder($input: CancelOrderInput!) {
    cancelOrder(input: $input) {
      ...OrderCommandResultFields
    }
  }
`);

// ─── Químico farmacéutico ─────────────────────────────────────────────

export const ReviewQueueQuery = graphql(`
  query ReviewQueue($status: OrderStatus) {
    ordersForReview(status: $status) {
      ...OrderSummaryFields
    }
  }
`);

export const OrderFeedSubscription = graphql(`
  subscription OrderFeed {
    orderFeed {
      ...OrderSummaryFields
    }
  }
`);

export const ReviewPrescriptionMutation = graphql(`
  mutation ReviewPrescription($input: ReviewPrescriptionInput!) {
    reviewPrescription(input: $input) {
      ...OrderCommandResultFields
    }
  }
`);

export const DispatchOrderMutation = graphql(`
  mutation DispatchOrder($input: DispatchOrderInput!) {
    dispatchOrder(input: $input) {
      ...OrderCommandResultFields
    }
  }
`);
