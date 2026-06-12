import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCatalogOverrides,
  buildCatalogOverridePayload,
  catalogoMateriais,
  catalogoPacotes,
  catalogoServicos,
} from './catalogoOrcamento.js';

test('catalogo de materiais possui precos e custos validos', () => {
  assert.ok(catalogoMateriais.length >= 10);
  catalogoMateriais.forEach((material) => {
    assert.ok(material.nome);
    assert.ok(material.categoria);
    assert.equal(typeof material.precoVenda, 'number');
    assert.ok(material.precoVenda > 0);
    assert.equal(typeof material.custo, 'number');
    assert.ok(material.custo >= 0);
  });
});

test('catalogo de servicos possui horas e valor por hora validos', () => {
  assert.ok(catalogoServicos.length >= 8);
  catalogoServicos.forEach((servico) => {
    assert.ok(servico.descricao);
    assert.ok(servico.categoria);
    assert.ok(servico.horas > 0);
    assert.ok(servico.valorHora > 0);
  });
});

test('pacotes combinam materiais e servicos para inclusao rapida', () => {
  assert.ok(catalogoPacotes.length >= 3);
  catalogoPacotes.forEach((pacote) => {
    assert.ok(pacote.nome);
    assert.ok(Array.isArray(pacote.materiais));
    assert.ok(Array.isArray(pacote.servicos));
    assert.ok(pacote.materiais.length > 0 || pacote.servicos.length > 0);
  });
});

test('applyCatalogOverrides aplica precos personalizados sem alterar itens sem override', () => {
  const result = applyCatalogOverrides(
    {
      materiais: catalogoMateriais,
      servicos: catalogoServicos,
      pacotes: catalogoPacotes,
    },
    {
      materiais: {
        'mat-cabo-25': { precoVenda: 7.5, custo: 4.1 },
      },
      servicos: {
        'serv-chuveiro': { valorHora: 180 },
      },
    },
  );

  assert.equal(result.materiais.find(item => item.id === 'mat-cabo-25').precoVenda, 7.5);
  assert.equal(result.servicos.find(item => item.id === 'serv-chuveiro').valorHora, 180);
  assert.equal(result.materiais.find(item => item.id === 'mat-cabo-40').precoVenda, 8.5);
});

test('buildCatalogOverridePayload limita campos por tipo e converte numeros', () => {
  assert.deepEqual(
    Object.keys(buildCatalogOverridePayload(
      'materiais',
      { id: 'mat-cabo-25' },
      { precoVenda: '8.75', valorHora: '200', custo: '4.25' },
    )).sort(),
    ['custo', 'id', 'precoVenda', 'updated_at'],
  );

  assert.equal(
    buildCatalogOverridePayload('servicos', { id: 'serv-visita' }, { valorHora: '150' }).valorHora,
    150,
  );
});
