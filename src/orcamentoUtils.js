export function getOrcamentoDraftItems(orcamento) {
  return {
    materiais: Array.isArray(orcamento?.itens) ? orcamento.itens : [],
    maoDeObra: Array.isArray(orcamento?.servicos) ? orcamento.servicos : [],
  };
}

export function getDraftValue(draft, draftKey, baseValue) {
  if (draft?.key === draftKey && draft.value !== null) {
    return draft.value;
  }

  return baseValue;
}

export function nextDraftState(previousDraft, draftKey, baseValue, updater) {
  const currentValue = getDraftValue(previousDraft, draftKey, baseValue);
  const nextValue = typeof updater === 'function' ? updater(currentValue) : updater;

  return {
    key: draftKey,
    value: nextValue,
  };
}

export function calculateOrcamentoTotals(materiais = [], maoDeObra = []) {
  const totalMateriais = materiais.reduce(
    (acc, material) => acc + Number(material.qtd || 0) * Number(material.precoVenda || 0),
    0,
  );

  const totalMaoDeObra = maoDeObra.reduce(
    (acc, servico) => acc + Number(servico.horas || 0) * Number(servico.valorHora || 0),
    0,
  );

  return {
    totalMateriais,
    totalMaoDeObra,
    totalGeral: totalMateriais + totalMaoDeObra,
  };
}

export function nextNumericId(items = [], step = 1) {
  const highestId = items.reduce((highest, item) => {
    const numericId = Number(item.id);
    return Number.isFinite(numericId) ? Math.max(highest, numericId) : highest;
  }, 0);

  return highestId + step;
}

export function estimateInternetPrice(nome, precoVenda) {
  const price = Number(precoVenda || 0);
  const seed = String(nome || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variance = 0.92 + (seed % 17) / 100;

  return Number((price * variance).toFixed(2));
}
