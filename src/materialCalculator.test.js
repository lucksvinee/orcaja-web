import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMaterialPlan } from './materialCalculator.js';

test('calcula metragem de cabo para novos pontos de tomada', () => {
  const plan = calculateMaterialPlan('tomada', {
    pontos: 2,
    distanciaMetros: 10,
    reservaPercentual: 15,
    circuitoNovo: true,
  });

  assert.equal(plan.materiais.find(item => item.nome === 'Cabo flexível 2,5mm').qtd, 69);
  assert.equal(plan.materiais.find(item => item.nome === 'Eletroduto corrugado 20mm').qtd, 22);
  assert.equal(plan.materiais.find(item => item.nome === 'Tomada 10A com placa').qtd, 2);
  assert.equal(plan.materiais.find(item => item.nome === 'Disjuntor monopolar 20A').qtd, 1);
  assert.equal(plan.servicos[0].horas, 4);
});

test('calcula instalacao de chuveiro sem aparelho quando usuario desmarca', () => {
  const plan = calculateMaterialPlan('chuveiro', {
    pontos: 1,
    distanciaMetros: 12,
    reservaPercentual: 20,
    circuitoNovo: true,
    incluirAparelho: false,
  });

  assert.equal(plan.materiais.find(item => item.nome === 'Cabo flexível 6mm').qtd, 44);
  assert.equal(plan.materiais.some(item => item.nome === 'Chuveiro elétrico 220V'), false);
  assert.equal(plan.materiais.find(item => item.nome === 'Disjuntor bipolar 32A').qtd, 1);
});

test('usa precos personalizados do catalogo quando informado', () => {
  const plan = calculateMaterialPlan('tomada', {
    pontos: 1,
    distanciaMetros: 5,
  }, {
    materiais: [
      { nome: 'Cabo flexível 2,5mm', precoVenda: 9.5, custo: 6 },
    ],
    servicos: [
      { descricao: 'Instalação de ponto de tomada', valorHora: 130 },
    ],
  });

  assert.equal(plan.materiais.find(item => item.nome === 'Cabo flexível 2,5mm').precoVenda, 9.5);
  assert.equal(plan.servicos[0].valorHora, 130);
});
