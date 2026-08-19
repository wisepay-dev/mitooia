# YUVEXPAY - MITO.IA Integration

Esta documentação descreve a integração Headless exclusiva entre a plataforma MITO.IA e o gateway de pagamento YuvexPay para transações PIX.

## Variáveis de Ambiente
- `YUVEX_API_KEY`: A chave secreta de autorização da API (Usar chave de testes no Sandbox e chave de prod na Vercel).
- `YUVEX_WEBHOOK_SECRET`: Segredo compartilhado (Signing Secret) para validação de integridade dos webhooks.
- `YUVEX_ENVIRONMENT`: `sandbox` ou `production`.

## Modo Sandbox
- O Sandbox não gera transações reais no Banco Central.
- Para testar no Sandbox, substitua `YUVEX_API_KEY` pela chave de desenvolvimento gerada no painel da YuvexPay e realize um mock/webhook manual usando o seu secret de teste.

## Produção
- Quando o tráfego pago iniciar, a chave oficial deve ser injetada. Lembre-se: `4.90` (decimal) é o valor transacionado de fato, ao invés da sintaxe em centavos clássica.

## Webhooks e Eventos
A rota configurada no painel oficial da YuvexPay deve ser: `https://[SEU_DOMINIO]/api/webhooks/yuvexpay`
- Evento OBRIGATÓRIO: `PAYMENT_PAID` (É o evento que desencadeia a mudança de estado e a liberação na MITO.IA).
- Proteção de Replay: Configurada para ignorar transações com timestamp `> 300 segundos`.
- Validação HMAC-SHA256: Todos os payloads passam por validação de *Raw Body* com o `YUVEX_WEBHOOK_SECRET`.

## Idempotência
Todas as requisições de criação de PIX usam a chave: `mito-order-[order.id]`.
Todos os webhooks utilizam o modelo do banco de dados `WebhookEvent` para guardar o `X-Webhook-Delivery-Id`. Duplicações lançam `P2002` do Prisma e retornam um `200` silencioso e seguro.

## Status Mapping
- O status interno `Order.status` utiliza "WAITING_PAYMENT" e "PAID". 
- O status `Payment.status` reflete estritamente os estados oficiais da YuvexPay (`NEW`, `PROCESSING`, `CONFIRMED`, `PAID`, `EXPIRED`, `CANCELLED`).
- Apenas o status `PAID` da YuvexPay destrava a foto com a OpenAI.

## Rotina de Teste E2E (Aprovação Manual)
Para simular a compra completa:
1. Faça o fluxo de Landing -> Upload -> Cenário.
2. Chegue no Checkout PIX. Copie a chave (ou o orderId).
3. No Insomnia/Postman ou mock local, dispare um POST para `/api/webhooks/yuvexpay` simulando a assinatura válida e evento `PAYMENT_PAID`.
4. O frontend passará automaticamente da tela de QR Code para "AGORA VAMOS CRIAR SUA FOTO".
