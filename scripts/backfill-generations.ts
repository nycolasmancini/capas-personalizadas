// Copia os pedidos já existentes para art_generations (uma linha por pedido),
// para o painel de uso não começar zerado. Pode rodar mais de uma vez.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    insert into art_generations (id, member_id, email, store_id, order_id, device_name, customer_name, preview_url, print_url, is_edit, created_at)
    select gen_random_uuid()::text, m.id, o.created_by, o.store_id, o.id, o.device_name, o.customer_name, o.preview_url, o.print_url, false, o.created_at
    from orders o
    left join members m on m.email = o.created_by
    where not exists (select 1 from art_generations g where g.order_id = o.id)
    returning id`;
  console.log(`${rows.length} artes copiadas dos pedidos existentes.`);
}

main();
