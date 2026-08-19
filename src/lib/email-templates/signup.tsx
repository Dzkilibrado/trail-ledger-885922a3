import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu cadastro no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>TrailBook</Text>
        <Heading style={h1}>Confirme seu cadastro</Heading>
        <Text style={text}>
          Que bom ter você no{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          , o histórico confiável da sua moto off-road.
        </Text>
        <Text style={text}>
          Confirme o e-mail <strong>{recipient}</strong> tocando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar e-mail
        </Button>
        <Text style={footer}>
          Se você não criou uma conta no TrailBook, pode ignorar esta mensagem.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#E4661B', textDecoration: 'underline' }
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
