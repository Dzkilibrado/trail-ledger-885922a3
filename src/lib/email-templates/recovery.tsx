import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinir sua senha do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>TrailBook</Text>
        <Heading style={h1}>Redefinir sua senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta no {siteName}.
          Toque no botão abaixo para criar uma nova senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Criar nova senha
        </Button>
        <Text style={footer}>
          Se você não solicitou, pode ignorar esta mensagem — sua senha continua
          a mesma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#f6f6f5', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = {
  padding: '32px 28px',
  backgroundColor: '#ffffff',
  borderRadius: '14px',
  maxWidth: '520px',
  margin: '24px auto',
  border: '1px solid #e8e6e3',
}
const brand = {
  fontSize: '13px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#E4661B',
  fontWeight: 'bold' as const,
  margin: '0 0 18px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1c1a19',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#E4661B',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
