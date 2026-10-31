create unique index if not exists builder_purchase_orders_subcontract_contract_unique
  on public.builder_purchase_orders (workspace_id, (metadata ->> 'tradeContractId'))
  where metadata ->> 'source' = 'estimate_builder_subcontract'
    and nullif(metadata ->> 'tradeContractId', '') is not null;

create unique index if not exists builder_purchase_order_items_subcontract_identity_unique
  on public.builder_purchase_order_items (workspace_id, purchase_order_id, source_procurement_item_id)
  where source_procurement_item_id like 'trade-contract:%';
