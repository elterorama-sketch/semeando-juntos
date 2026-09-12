create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_campaigns_updated_at before update on campaigns
  for each row execute function set_updated_at();
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();
create trigger trg_campaign_numbers_updated_at before update on campaign_numbers
  for each row execute function set_updated_at();

-- Enable realtime for the tables the grid/dashboard/treasury screens need
-- to reflect live changes without a page refresh.
alter publication supabase_realtime add table campaign_numbers;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table payments;
