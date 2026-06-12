import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrcamentoTotals,
  estimateInternetPrice,
  getDraftValue,
  getOrcamentoDraftItems,
  nextDraftState,
  nextNumericId,
} from './orcamentoUtils.js';

test('getOrcamentoDraftItems normaliza itens e servicos inexistentes', () => {
  assert.deepEqual(getOrcamentoDraftItems(null), {
    materiais: [],
    maoDeObra: [],
  });

  assert.deepEqual(getOrcamentoDraftItems({ itens: 'invalido', servicos: null }), {
    materiais: [],
    maoDeObra: [],
  });
});

test('getOrcamentoDraftItems preserva materiais e mao de obra validos', () => {
  const materiais = [{ id: 1, nome: 'Cabo', qtd: 2, precoVenda: 10 }];
  const servicos = [{ id: 2, descricao: 'Instalacao', horas: 3, valorHora: 50 }];

  assert.deepEqual(getOrcamentoDraftItems({ itens: materiais, servicos }), {
    materiais,
    maoDeObra: servicos,
  });
});

test('draft usa base enquanto nao ha edicao local para a rota atual', () => {
  const base = [{ id: 1, nome: 'Disjuntor' }];

  assert.equal(getDraftValue({ key: 'outro', value: [{ id: 9 }] }, 'atual', base), base);
  assert.equal(getDraftValue({ key: 'atual', value: null }, 'atual', base), base);
});

test('nextDraftState aplica atualizacao sobre a base ou sobre o rascunho existente', () => {
  const base = [{ id: 1, qtd: 1 }];
  const draft = nextDraftState({ key: 'orc-1', value: null }, 'orc-1', base, (items) => [
    ...items,
    { id: 2, qtd: 3 },
  ]);

  assert.deepEqual(draft, {
    key: 'orc-1',
    value: [
      { id: 1, qtd: 1 },
      { id: 2, qtd: 3 },
    ],
  });

  assert.deepEqual(
    nextDraftState(draft, 'orc-1', base, [{ id: 3, qtd: 5 }]),
    { key: 'orc-1', value: [{ id: 3, qtd: 5 }] },
  );
});

test('calculateOrcamentoTotals soma materiais, servicos e total geral', () => {
  assert.deepEqual(
    calculateOrcamentoTotals(
      [
        { qtd: 2, precoVenda: 10.5 },
        { qtd: 3, precoVenda: 4 },
      ],
      [
        { horas: 2, valorHora: 75 },
        { horas: 1, valorHora: 120 },
      ],
    ),
    {
      totalMateriais: 33,
      totalMaoDeObra: 270,
      totalGeral: 303,
    },
  );
});

test('nextNumericId ignora ids nao numericos e retorna o proximo numero', () => {
  assert.equal(nextNumericId([{ id: 'a' }, { id: 10 }, { id: 4 }]), 11);
  assert.equal(nextNumericId([], 1000), 1000);
});

test('estimateInternetPrice gera uma estimativa deterministica', () => {
  assert.equal(estimateInternetPrice('Cabo flexivel', 100), estimateInternetPrice('Cabo flexivel', 100));
  assert.equal(estimateInternetPrice('Cabo flexivel', 100), 102);
});
