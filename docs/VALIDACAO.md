# Verificação — cliente e dono (v1.2)

## Regras e permissões

Onze testes aprovados: datas reais/bissextas, fuso, domingos, datas passadas, limite de 90 dias, almoço/fechamento, sobreposição, intervalos adjacentes, alinhamento, configuração explícita do administrador e cancelamento próprio futuro.

## Integração HTTP com D1 local

Dois cenários completos aprovados:

1. Reserva simultânea, rollback da transação perdedora, bloqueio sobreposto, preservação do preço/duração, cancelamento/liberação, conclusão e rejeição de dados inválidos.
2. Dono, Alice e Bruno: APIs administrativas retornam 403 para clientes; catálogo não contém dados pessoais; somente a própria conta recebe sua reserva; outra conta não pode cancelá-la; cliente não pode concluir atendimento nem enviar uma identidade forjada; disputa entre clientes confirma somente uma reserva; dono vê a reserva como Online; bloqueio do dono afeta disponibilidade sem expor o motivo; atendimento concluído não pode ser cancelado pelo cliente.

## Navegador

Chrome headless com contas fictícias separadas verificou a entrada das duas áreas, redirecionamento de cliente ao tentar /admin, reserva pela Alice, exibição na agenda do dono, cancelamento e histórico. A conta Bruno não acessou a API administrativa. Nenhum erro JavaScript de página.

Portal, fluxo do cliente, minhas reservas e administração verificados em 320, 390, 768 e 1440 px sem transbordamento horizontal. Capturas atualizadas em docs/.

## Migrações e produção

A migração incremental 0001_business_and_clients foi aplicada no banco local. Ela mantém os atendimentos existentes, adiciona identidade do cliente/origem, índices e o cadastro do negócio. A aplicação final passa por verificação TypeScript e build antes da publicação.

Os testes de três identidades usam middleware exclusivo do desenvolvimento, ativado por dev:roles, e não validam o provedor de login de produção. A integração de identidade publicada usa o fluxo gerenciado do Sites. O compartilhamento da demonstração continua privado e não foi ampliado por esta mudança.

## Revisão de entrega — 28/10/2026

Testes HTTP executados novamente com três identidades, TypeScript e build aprovados. A navegação visual em Opera confirmou a entrada explícita, identificação do papel na conta e carregamento do painel do dono. O botão de atualização e a atualização automática preservam a agenda visível.
