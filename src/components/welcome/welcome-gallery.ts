import trilhaAmanhecer from "@/assets/welcome/trilha-amanhecer.jpg";
import trilhaRio from "@/assets/welcome/trilha-rio.jpg";
import paisagemSerra from "@/assets/welcome/paisagem-serra.jpg";
import oficinaManutencao from "@/assets/welcome/oficina-manutencao.jpg";
import detalheMecanico from "@/assets/welcome/detalhe-mecanico.jpg";
import competicao from "@/assets/welcome/competicao.jpg";

export type WelcomeCollection =
  | "Trilhas"
  | "Motocicletas"
  | "Paisagens"
  | "Oficina"
  | "Competições"
  | "Detalhes mecânicos";

export type WelcomeImage = {
  id: string;
  collection: WelcomeCollection;
  src: string;
  alt: string;
};

/**
 * Biblioteca oficial de imagens da Tela de Boas-vindas do TrailBook.
 * Para adicionar uma nova imagem, basta incluir um item nesta lista.
 */
export const WELCOME_GALLERY: WelcomeImage[] = [
  {
    id: "trilha-amanhecer",
    collection: "Trilhas",
    src: trilhaAmanhecer,
    alt: "Moto de trilha em estrada de terra ao amanhecer",
  },
  {
    id: "trilha-rio",
    collection: "Trilhas",
    src: trilhaRio,
    alt: "Dois pilotos atravessando um rio de pedras na serra",
  },
  {
    id: "paisagem-serra",
    collection: "Paisagens",
    src: paisagemSerra,
    alt: "Motocicleta parada em um mirante ao entardecer",
  },
  {
    id: "oficina-manutencao",
    collection: "Oficina",
    src: oficinaManutencao,
    alt: "Mecânico realizando manutenção em motor de motocicleta",
  },
  {
    id: "detalhe-mecanico",
    collection: "Detalhes mecânicos",
    src: detalheMecanico,
    alt: "Detalhe da corrente e coroa de uma moto off-road",
  },
  {
    id: "competicao",
    collection: "Competições",
    src: competicao,
    alt: "Piloto acelerando em prova off-road com poeira ao fundo",
  },
];