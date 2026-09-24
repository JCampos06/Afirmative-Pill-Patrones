/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment MedicationCardFields on Medication {\n    id\n    name\n    presentation\n    dosage\n    price\n    requiresPrescription\n    availability {\n      status\n    }\n  }\n": typeof types.MedicationCardFieldsFragmentDoc,
    "\n  fragment CartFields on Cart {\n    id\n    status\n    itemCount\n    subtotal\n    requiresPrescription\n    updatedAt\n    items {\n      id\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        presentation\n        price\n        requiresPrescription\n        availability {\n          status\n          unitsAvailable\n        }\n      }\n    }\n  }\n": typeof types.CartFieldsFragmentDoc,
    "\n  fragment CartResultFields on CartResult {\n    __typename\n    ... on CartPayload {\n      cart {\n        ...CartFields\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n    ... on InsufficientStockError {\n      shortages {\n        requested\n        available\n        medication {\n          id\n          name\n        }\n      }\n    }\n  }\n": typeof types.CartResultFieldsFragmentDoc,
    "\n  fragment OrderSummaryFields on OrderSummary {\n    id\n    code\n    status\n    total\n    itemCount\n    requiresPrescription\n    customerName\n    shippingAddress\n    placedAt\n    updatedAt\n    projectionVersion\n    syncedAt\n    items {\n      medicationId\n      sku\n      name\n      quantity\n      unitPrice\n      subtotal\n      requiresPrescription\n    }\n    prescription {\n      status\n      doctorName\n      doctorLicense\n      patientDocument\n      issuedAt\n      documentUrl\n      reviewNotes\n      reviewedAt\n    }\n    statusHistory {\n      status\n      at\n      note\n      actor\n    }\n  }\n": typeof types.OrderSummaryFieldsFragmentDoc,
    "\n  fragment OrderCommandResultFields on OrderCommandResult {\n    __typename\n    ... on OrderCommandPayload {\n      receipt {\n        orderId\n        code\n        status\n        acceptedAt\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n  }\n": typeof types.OrderCommandResultFieldsFragmentDoc,
    "\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      edges {\n        cursor\n        node {\n          ...MedicationCardFields\n        }\n      }\n    }\n  }\n": typeof types.CatalogDocument,
    "\n  query Categories {\n    categories {\n      id\n      name\n      medicationCount\n    }\n  }\n": typeof types.CategoriesDocument,
    "\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      id\n      sku\n      name\n      activeIngredient\n      dosage\n      presentation\n      price\n      requiresPrescription\n      description\n      category {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      availability {\n        status\n        unitsAvailable\n        syncedAt\n      }\n    }\n  }\n": typeof types.MedicationDetailDocument,
    "\n  query Me {\n    me {\n      id\n      email\n      fullName\n      documentNumber\n      role\n    }\n  }\n": typeof types.MeDocument,
    "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n    }\n  }\n": typeof types.LoginDocument,
    "\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n    }\n  }\n": typeof types.RegisterDocument,
    "\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n": typeof types.MyCartDocument,
    "\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n": typeof types.AddItemToCartDocument,
    "\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      ...CartResultFields\n    }\n  }\n": typeof types.UpdateCartItemQuantityDocument,
    "\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n": typeof types.RemoveItemFromCartDocument,
    "\n  mutation PlaceOrder($input: PlaceOrderInput!) {\n    placeOrder(input: $input) {\n      __typename\n      ... on PlaceOrderPayload {\n        receipt {\n          orderId\n          code\n          status\n          total\n          requiresPrescription\n          acceptedAt\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n      ... on PrescriptionRequiredError {\n        medications {\n          id\n          name\n        }\n      }\n      ... on InsufficientStockError {\n        shortages {\n          requested\n          available\n          medication {\n            id\n            name\n          }\n        }\n      }\n    }\n  }\n": typeof types.PlaceOrderDocument,
    "\n  query MyOrders {\n    myOrders {\n      id\n      code\n      status\n      total\n      itemCount\n      requiresPrescription\n      placedAt\n    }\n  }\n": typeof types.MyOrdersDocument,
    "\n  query Order($id: ID!) {\n    order(id: $id) {\n      ...OrderSummaryFields\n    }\n  }\n": typeof types.OrderDocument,
    "\n  subscription OrderStatusChanged($orderId: ID!) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderSummaryFields\n    }\n  }\n": typeof types.OrderStatusChangedDocument,
    "\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n": typeof types.CancelOrderDocument,
    "\n  query ReviewQueue($status: OrderStatus) {\n    ordersForReview(status: $status) {\n      ...OrderSummaryFields\n    }\n  }\n": typeof types.ReviewQueueDocument,
    "\n  subscription OrderFeed {\n    orderFeed {\n      ...OrderSummaryFields\n    }\n  }\n": typeof types.OrderFeedDocument,
    "\n  mutation ReviewPrescription($input: ReviewPrescriptionInput!) {\n    reviewPrescription(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n": typeof types.ReviewPrescriptionDocument,
    "\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n": typeof types.DispatchOrderDocument,
};
const documents: Documents = {
    "\n  fragment MedicationCardFields on Medication {\n    id\n    name\n    presentation\n    dosage\n    price\n    requiresPrescription\n    availability {\n      status\n    }\n  }\n": types.MedicationCardFieldsFragmentDoc,
    "\n  fragment CartFields on Cart {\n    id\n    status\n    itemCount\n    subtotal\n    requiresPrescription\n    updatedAt\n    items {\n      id\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        presentation\n        price\n        requiresPrescription\n        availability {\n          status\n          unitsAvailable\n        }\n      }\n    }\n  }\n": types.CartFieldsFragmentDoc,
    "\n  fragment CartResultFields on CartResult {\n    __typename\n    ... on CartPayload {\n      cart {\n        ...CartFields\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n    ... on InsufficientStockError {\n      shortages {\n        requested\n        available\n        medication {\n          id\n          name\n        }\n      }\n    }\n  }\n": types.CartResultFieldsFragmentDoc,
    "\n  fragment OrderSummaryFields on OrderSummary {\n    id\n    code\n    status\n    total\n    itemCount\n    requiresPrescription\n    customerName\n    shippingAddress\n    placedAt\n    updatedAt\n    projectionVersion\n    syncedAt\n    items {\n      medicationId\n      sku\n      name\n      quantity\n      unitPrice\n      subtotal\n      requiresPrescription\n    }\n    prescription {\n      status\n      doctorName\n      doctorLicense\n      patientDocument\n      issuedAt\n      documentUrl\n      reviewNotes\n      reviewedAt\n    }\n    statusHistory {\n      status\n      at\n      note\n      actor\n    }\n  }\n": types.OrderSummaryFieldsFragmentDoc,
    "\n  fragment OrderCommandResultFields on OrderCommandResult {\n    __typename\n    ... on OrderCommandPayload {\n      receipt {\n        orderId\n        code\n        status\n        acceptedAt\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n  }\n": types.OrderCommandResultFieldsFragmentDoc,
    "\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      edges {\n        cursor\n        node {\n          ...MedicationCardFields\n        }\n      }\n    }\n  }\n": types.CatalogDocument,
    "\n  query Categories {\n    categories {\n      id\n      name\n      medicationCount\n    }\n  }\n": types.CategoriesDocument,
    "\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      id\n      sku\n      name\n      activeIngredient\n      dosage\n      presentation\n      price\n      requiresPrescription\n      description\n      category {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      availability {\n        status\n        unitsAvailable\n        syncedAt\n      }\n    }\n  }\n": types.MedicationDetailDocument,
    "\n  query Me {\n    me {\n      id\n      email\n      fullName\n      documentNumber\n      role\n    }\n  }\n": types.MeDocument,
    "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n    }\n  }\n": types.LoginDocument,
    "\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n    }\n  }\n": types.RegisterDocument,
    "\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n": types.MyCartDocument,
    "\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n": types.AddItemToCartDocument,
    "\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      ...CartResultFields\n    }\n  }\n": types.UpdateCartItemQuantityDocument,
    "\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n": types.RemoveItemFromCartDocument,
    "\n  mutation PlaceOrder($input: PlaceOrderInput!) {\n    placeOrder(input: $input) {\n      __typename\n      ... on PlaceOrderPayload {\n        receipt {\n          orderId\n          code\n          status\n          total\n          requiresPrescription\n          acceptedAt\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n      ... on PrescriptionRequiredError {\n        medications {\n          id\n          name\n        }\n      }\n      ... on InsufficientStockError {\n        shortages {\n          requested\n          available\n          medication {\n            id\n            name\n          }\n        }\n      }\n    }\n  }\n": types.PlaceOrderDocument,
    "\n  query MyOrders {\n    myOrders {\n      id\n      code\n      status\n      total\n      itemCount\n      requiresPrescription\n      placedAt\n    }\n  }\n": types.MyOrdersDocument,
    "\n  query Order($id: ID!) {\n    order(id: $id) {\n      ...OrderSummaryFields\n    }\n  }\n": types.OrderDocument,
    "\n  subscription OrderStatusChanged($orderId: ID!) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderSummaryFields\n    }\n  }\n": types.OrderStatusChangedDocument,
    "\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n": types.CancelOrderDocument,
    "\n  query ReviewQueue($status: OrderStatus) {\n    ordersForReview(status: $status) {\n      ...OrderSummaryFields\n    }\n  }\n": types.ReviewQueueDocument,
    "\n  subscription OrderFeed {\n    orderFeed {\n      ...OrderSummaryFields\n    }\n  }\n": types.OrderFeedDocument,
    "\n  mutation ReviewPrescription($input: ReviewPrescriptionInput!) {\n    reviewPrescription(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n": types.ReviewPrescriptionDocument,
    "\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n": types.DispatchOrderDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MedicationCardFields on Medication {\n    id\n    name\n    presentation\n    dosage\n    price\n    requiresPrescription\n    availability {\n      status\n    }\n  }\n"): (typeof documents)["\n  fragment MedicationCardFields on Medication {\n    id\n    name\n    presentation\n    dosage\n    price\n    requiresPrescription\n    availability {\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment CartFields on Cart {\n    id\n    status\n    itemCount\n    subtotal\n    requiresPrescription\n    updatedAt\n    items {\n      id\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        presentation\n        price\n        requiresPrescription\n        availability {\n          status\n          unitsAvailable\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  fragment CartFields on Cart {\n    id\n    status\n    itemCount\n    subtotal\n    requiresPrescription\n    updatedAt\n    items {\n      id\n      quantity\n      lineTotal\n      medication {\n        id\n        name\n        presentation\n        price\n        requiresPrescription\n        availability {\n          status\n          unitsAvailable\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment CartResultFields on CartResult {\n    __typename\n    ... on CartPayload {\n      cart {\n        ...CartFields\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n    ... on InsufficientStockError {\n      shortages {\n        requested\n        available\n        medication {\n          id\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  fragment CartResultFields on CartResult {\n    __typename\n    ... on CartPayload {\n      cart {\n        ...CartFields\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n    ... on InsufficientStockError {\n      shortages {\n        requested\n        available\n        medication {\n          id\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment OrderSummaryFields on OrderSummary {\n    id\n    code\n    status\n    total\n    itemCount\n    requiresPrescription\n    customerName\n    shippingAddress\n    placedAt\n    updatedAt\n    projectionVersion\n    syncedAt\n    items {\n      medicationId\n      sku\n      name\n      quantity\n      unitPrice\n      subtotal\n      requiresPrescription\n    }\n    prescription {\n      status\n      doctorName\n      doctorLicense\n      patientDocument\n      issuedAt\n      documentUrl\n      reviewNotes\n      reviewedAt\n    }\n    statusHistory {\n      status\n      at\n      note\n      actor\n    }\n  }\n"): (typeof documents)["\n  fragment OrderSummaryFields on OrderSummary {\n    id\n    code\n    status\n    total\n    itemCount\n    requiresPrescription\n    customerName\n    shippingAddress\n    placedAt\n    updatedAt\n    projectionVersion\n    syncedAt\n    items {\n      medicationId\n      sku\n      name\n      quantity\n      unitPrice\n      subtotal\n      requiresPrescription\n    }\n    prescription {\n      status\n      doctorName\n      doctorLicense\n      patientDocument\n      issuedAt\n      documentUrl\n      reviewNotes\n      reviewedAt\n    }\n    statusHistory {\n      status\n      at\n      note\n      actor\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment OrderCommandResultFields on OrderCommandResult {\n    __typename\n    ... on OrderCommandPayload {\n      receipt {\n        orderId\n        code\n        status\n        acceptedAt\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n  }\n"): (typeof documents)["\n  fragment OrderCommandResultFields on OrderCommandResult {\n    __typename\n    ... on OrderCommandPayload {\n      receipt {\n        orderId\n        code\n        status\n        acceptedAt\n      }\n    }\n    ... on DomainError {\n      code\n      message\n    }\n    ... on ValidationError {\n      fieldErrors {\n        field\n        message\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      edges {\n        cursor\n        node {\n          ...MedicationCardFields\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Catalog($filter: MedicationFilter, $sort: MedicationSort, $first: Int, $after: String) {\n    medications(filter: $filter, sort: $sort, first: $first, after: $after) {\n      totalCount\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      edges {\n        cursor\n        node {\n          ...MedicationCardFields\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Categories {\n    categories {\n      id\n      name\n      medicationCount\n    }\n  }\n"): (typeof documents)["\n  query Categories {\n    categories {\n      id\n      name\n      medicationCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      id\n      sku\n      name\n      activeIngredient\n      dosage\n      presentation\n      price\n      requiresPrescription\n      description\n      category {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      availability {\n        status\n        unitsAvailable\n        syncedAt\n      }\n    }\n  }\n"): (typeof documents)["\n  query MedicationDetail($id: ID!) {\n    medication(id: $id) {\n      id\n      sku\n      name\n      activeIngredient\n      dosage\n      presentation\n      price\n      requiresPrescription\n      description\n      category {\n        id\n        name\n      }\n      laboratory {\n        id\n        name\n      }\n      availability {\n        status\n        unitsAvailable\n        syncedAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      id\n      email\n      fullName\n      documentNumber\n      role\n    }\n  }\n"): (typeof documents)["\n  query Me {\n    me {\n      id\n      email\n      fullName\n      documentNumber\n      role\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on AuthPayload {\n        token\n        user {\n          id\n          fullName\n          role\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n"): (typeof documents)["\n  query MyCart {\n    myCart {\n      ...CartFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n"): (typeof documents)["\n  mutation AddItemToCart($input: AddItemToCartInput!) {\n    addItemToCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      ...CartResultFields\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) {\n    updateCartItemQuantity(input: $input) {\n      ...CartResultFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {\n    removeItemFromCart(input: $input) {\n      ...CartResultFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PlaceOrder($input: PlaceOrderInput!) {\n    placeOrder(input: $input) {\n      __typename\n      ... on PlaceOrderPayload {\n        receipt {\n          orderId\n          code\n          status\n          total\n          requiresPrescription\n          acceptedAt\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n      ... on PrescriptionRequiredError {\n        medications {\n          id\n          name\n        }\n      }\n      ... on InsufficientStockError {\n        shortages {\n          requested\n          available\n          medication {\n            id\n            name\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation PlaceOrder($input: PlaceOrderInput!) {\n    placeOrder(input: $input) {\n      __typename\n      ... on PlaceOrderPayload {\n        receipt {\n          orderId\n          code\n          status\n          total\n          requiresPrescription\n          acceptedAt\n        }\n      }\n      ... on DomainError {\n        code\n        message\n      }\n      ... on ValidationError {\n        fieldErrors {\n          field\n          message\n        }\n      }\n      ... on PrescriptionRequiredError {\n        medications {\n          id\n          name\n        }\n      }\n      ... on InsufficientStockError {\n        shortages {\n          requested\n          available\n          medication {\n            id\n            name\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyOrders {\n    myOrders {\n      id\n      code\n      status\n      total\n      itemCount\n      requiresPrescription\n      placedAt\n    }\n  }\n"): (typeof documents)["\n  query MyOrders {\n    myOrders {\n      id\n      code\n      status\n      total\n      itemCount\n      requiresPrescription\n      placedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Order($id: ID!) {\n    order(id: $id) {\n      ...OrderSummaryFields\n    }\n  }\n"): (typeof documents)["\n  query Order($id: ID!) {\n    order(id: $id) {\n      ...OrderSummaryFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription OrderStatusChanged($orderId: ID!) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderSummaryFields\n    }\n  }\n"): (typeof documents)["\n  subscription OrderStatusChanged($orderId: ID!) {\n    orderStatusChanged(orderId: $orderId) {\n      ...OrderSummaryFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n"): (typeof documents)["\n  mutation CancelOrder($input: CancelOrderInput!) {\n    cancelOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ReviewQueue($status: OrderStatus) {\n    ordersForReview(status: $status) {\n      ...OrderSummaryFields\n    }\n  }\n"): (typeof documents)["\n  query ReviewQueue($status: OrderStatus) {\n    ordersForReview(status: $status) {\n      ...OrderSummaryFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription OrderFeed {\n    orderFeed {\n      ...OrderSummaryFields\n    }\n  }\n"): (typeof documents)["\n  subscription OrderFeed {\n    orderFeed {\n      ...OrderSummaryFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ReviewPrescription($input: ReviewPrescriptionInput!) {\n    reviewPrescription(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n"): (typeof documents)["\n  mutation ReviewPrescription($input: ReviewPrescriptionInput!) {\n    reviewPrescription(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n"): (typeof documents)["\n  mutation DispatchOrder($input: DispatchOrderInput!) {\n    dispatchOrder(input: $input) {\n      ...OrderCommandResultFields\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;