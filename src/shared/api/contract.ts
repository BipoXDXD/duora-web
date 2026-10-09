import type { components } from './schema.ts'

/**
 * Nomes curtos para os DTOs do contrato da API. Os campos moram só em `schema.d.ts`, gerado de
 * `api/openapi.json` por `npm run api:types`: aqui ninguém recria campo à mão. Só entram os DTOs que o
 * front já usa; acrescente o alias quando uma feature precisar de outro.
 */
export type CurrentUserResponse = components['schemas']['CurrentUserResponse']
export type JoinWaitlistRequest = components['schemas']['JoinWaitlistRequest']
export type LogoutResponse = components['schemas']['LogoutResponse']
export type ProfileResponse = components['schemas']['ProfileResponse']
export type EditProfileRequest = components['schemas']['EditProfileRequest']
export type BlockedAccountsResponse = components['schemas']['BlockedAccountsResponse']
export type FieldErrorWire = components['schemas']['FieldError']
export type RefusalProblemDetailWire = components['schemas']['RefusalProblemDetail']
export type EventResponse = components['schemas']['EventResponse']
export type EventsPageResponse = components['schemas']['PageResponseEventResponse']
export type RegistrationResponse = components['schemas']['RegistrationResponse']
export type MyRegistrationsPageResponse = components['schemas']['PageResponseMyRegistrationResponse']
export type PairingResponse = components['schemas']['PairingResponse']
export type DecideRequest = components['schemas']['DecideRequest']
export type DecisionResponse = components['schemas']['DecisionResponse']
export type ConnectionsResponse = components['schemas']['ConnectionsResponse']
export type CreateEventRequest = components['schemas']['CreateEventRequest']
export type AdminEventResponse = components['schemas']['AdminEventResponse']
export type AdminEventsPageResponse = components['schemas']['PageResponseAdminEventResponse']
export type AdminRoundResponse = components['schemas']['AdminRoundResponse']
export type ChatResponse = components['schemas']['Chat']
export type ChatMessageResponse = components['schemas']['ChatMessage']
export type ChatMessagesResponse = components['schemas']['ChatMessages']
export type SendMessageRequest = components['schemas']['SendMessageRequest']
