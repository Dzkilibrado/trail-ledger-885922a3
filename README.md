# TrailBook: Your Bike's Story

Crie um aplicativo web/mobile chamado TrailBook.

O TrailBook é um prontuário digital para motocicletas off-road, com foco em Honda CRF, Yamaha WR, KTM, GasGas, Husqvarna e outras motos de trilha.

O objetivo do sistema não é apenas controlar manutenções, mas construir um histórico completo, confiável e permanente da motocicleta, semelhante ao conceito do Carfax aplicado ao mercado brasileiro de motos off-road.

## Tecnologias

- React

- TypeScript

- Vite

- Tailwind CSS

- Shadcn UI

- Supabase (Auth, Database e Storage)

## Design

Tema escuro premium.

Paleta:

- Preto grafite

- Cinza escuro

- Laranja como cor principal

- Branco para textos

Visual moderno, inspirado em aplicativos automotivos premium.

## Arquitetura

A entidade central é a motocicleta.

Cada moto possui uma Linha do Tempo (Timeline) composta por eventos.

Os eventos podem ser:

- Registro de uso

- Manutenção

- Revisão

- Instalação de acessórios

- Fotos

- Vídeos

- Documentos

- Compra

- Venda

- Troca de proprietário

- Recall

- Garantia

- Observações

Todos os eventos devem aparecer em ordem cronológica.

## Funcionalidades

### Dashboard

- Foto da moto

- Horas

- Quilometragem

- Índice de Conservação

- Próxima manutenção

- Últimos eventos

- Alertas

### Cadastro da moto

- Marca

- Modelo

- Ano de fabricação

- Ano modelo

- Cilindrada

- Tipo de controle (Horas, Km ou Ambos)

- Chassi

- Número do motor (opcional)

- Placa (opcional)

- RENAVAM (opcional)

- Foto principal

- Fotos adicionais

- Documentos

### Registro de uso

- Data

- Horas utilizadas

- Quilômetros percorridos

- Local

- Observações

- Fotos

- Soma automática dos acumulados

### Manutenções

Catálogo estruturado por categorias:

- Motor

- Suspensão

- Freios

- Transmissão

- Rodas

- Elétrica

- Arrefecimento

- Outros

Cada manutenção deve permitir:

- Serviço realizado

- Produto utilizado

- Marca

- Quantidade

- Valor

- Oficina responsável

- Fotos

- Vídeos

- Nota fiscal

- Garantia

- Horas/Km da moto

- Intervalo configurável por horas, quilômetros e tempo

### Agenda Inteligente

Gerar automaticamente alertas considerando:

- Horas

- Quilometragem

- Dias

Executar a manutenção quando o primeiro limite for atingido.

### Índice de Conservação

Pontuação de 0 a 100 baseada em regras transparentes:

- Manutenções em dia

- Evidências anexadas

- Histórico contínuo

- Atrasos

- Documentação

Exibir a nota e os fatores positivos e negativos.

### Certificado Digital

Gerar um certificado com QR Code.

Criar uma página pública para consulta do histórico autorizado pelo proprietário.

Permitir exportação em PDF.

### Oficina

Permitir cadastro de oficinas parceiras.

As oficinas podem registrar serviços e assinar digitalmente as manutenções realizadas.

### Financeiro

Apresentar gastos por período, categoria e motocicleta.

Gerar gráficos e relatórios.

## Requisitos

- Interface totalmente responsiva

- Navegação mobile-first

- Atualização em tempo real com Supabase

- Upload de arquivos para Storage

- Estrutura escalável para múltiplas motos por usuário

- Código organizado em componentes reutilizáveis

- Preparado para futuras integrações com planos Premium, oficinas e marketplace.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://trail-ledger.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/817d5e69-8131-49e7-b222-78206b479db9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
