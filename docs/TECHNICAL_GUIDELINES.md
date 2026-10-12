# Diretrizes técnicas — Lia Go

Este documento define restrições e critérios, não escolhe prematuramente um stack. Primeiro inspecionar o repositório e o ambiente de execução.

## Arquitetura e domínio
- Separar interface, regras de domínio, persistência e integrações externas.
- Centralizar transições de estado e cálculos em serviços testáveis.
- Aplicar autorização no servidor para cada operação.
- Definir modelos explícitos para viagens, membros/convites, atividades, reservas, documentos, despesas, parcelas de rateio, movimentos de reembolso, saldos/acertos, notificações e trilha de auditoria.
- Usar migrações versionadas e estratégia de backup/restauração adequada ao ambiente.

## Dinheiro e câmbio
- Armazenar valores com representação decimal exata ou unidades mínimas inteiras, nunca float binário como fonte oficial.
- Documentar escala, moeda, arredondamento e alocação de centavos.
- Preservar dados de origem e taxa histórica.
- Cálculos reproduzíveis e cobertos por testes de propriedades e casos-limite.
- Separar valores provisórios dos confirmados.

## Concorrência e sincronização
- Não resolver conflito apenas por timestamp do dispositivo.
- Guardar versão/estado necessário para detectar edição concorrente.
- Revalidar permissões no momento da sincronização.
- Operações offline ficam pendentes até validação e confirmação; idempotência para evitar duplicação.
- Mostrar último sync e estado desatualizado.

## Segurança e privacidade
- Princípio do menor privilégio, validação de entrada, proteção de sessão, limitação de tentativas quando aplicável e gestão segura de segredos.
- Documentos e localização privados por padrão.
- Consentimento separado para localização ao vivo e histórico; duração e retenção explícitas.
- Minimizar dados pessoais em logs, analytics e push.
- Exportação respeita as mesmas permissões da interface.
- Implementar exclusão/retensão conforme política a definir; não apagar registros financeiros compartilhados silenciosamente.
- Testes negativos de autorização entre viagens e participantes.

## IA e integrações
- IA retorna propostas estruturadas sujeitas a validação; nunca escreve diretamente saldos oficiais.
- Tratar saída do modelo como conteúdo não confiável.
- Ter limites, monitoramento de custo, timeout, fallback e possibilidade de desligar integração.
- Não alegar status em tempo real sem fonte atualizada.
- Integrações externas devem expor estado de conexão, falha e última atualização.
- Não confirmar reservas, pagamentos ou cancelamentos sem confirmação/evidência da integração real.

## Qualidade
- Testes unitários para regras e cálculos; integração para autorização/persistência; testes de interface para fluxos críticos.
- Cobrir estados: loading, vazio, erro, offline, conflito, sucesso e não autorizado.
- Usar dados sintéticos em desenvolvimento e testes.
- Documentar como configurar, executar, testar e compilar.
