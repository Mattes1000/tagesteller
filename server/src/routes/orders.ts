import { db } from "../db";

export async function handleOrders(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname;

  // GET /api/orders/locked-dates
  if (req.method === "GET" && path === "/api/orders/locked-dates") {
    const rows = db.query("SELECT locked_date FROM locked_dates").all() as { locked_date: string }[];
    return Response.json(rows.map(r => r.locked_date));
  }

  // POST /api/orders/lock-date
  if (req.method === "POST" && path === "/api/orders/lock-date") {
    const body = await req.json() as { date: string };
    
    if (!body.date) {
      return Response.json({ error: "Datum erforderlich." }, { status: 400 });
    }

    try {
      db.query("INSERT INTO locked_dates (locked_date) VALUES ($date)")
        .run({ $date: body.date });
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: "Datum bereits fixiert." }, { status: 400 });
    }
  }

  // DELETE /api/orders/unlock-date
  if (req.method === "DELETE" && path === "/api/orders/unlock-date") {
    const url_params = new URL(req.url).searchParams;
    const date = url_params.get("date");
    
    if (!date) {
      return Response.json({ error: "Datum erforderlich." }, { status: 400 });
    }

    db.query("DELETE FROM locked_dates WHERE locked_date = $date")
      .run({ $date: date });
    
    return Response.json({ success: true });
  }

  // GET /api/orders/check?user_id=X&date=YYYY-MM-DD
  if (req.method === "GET" && path === "/api/orders/check") {
    const userId = url.searchParams.get("user_id");
    const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    
    if (!userId) {
      return Response.json({ hasOrder: false, menuId: null });
    }

    const existingOrder = db.query(`
      SELECT o.id, oi.menu_id
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $user_id AND o.order_date = $date
      LIMIT 1
    `).get({ $user_id: parseInt(userId), $date: date }) as { id: number; menu_id: number } | null;
    
    return Response.json({ 
      hasOrder: !!existingOrder,
      menuId: existingOrder?.menu_id ?? null
    });
  }

  // GET /api/orders?user_id=X
  if (req.method === "GET" && path === "/api/orders") {
    const userId = url.searchParams.get("user_id");
    const rows = db.query(`
      SELECT o.*,
             u.firstname || ' ' || u.lastname as user_fullname,
             u.role as user_role,
             GROUP_CONCAT(m.name || ' x' || oi.quantity) as items
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menus m ON m.id = oi.menu_id
      ${userId ? "WHERE o.user_id = $user_id" : ""}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(userId ? { $user_id: parseInt(userId) } : {});
    return Response.json(rows);
  }

  // POST /api/orders
  if (req.method === "POST" && path === "/api/orders") {
    const body = await req.json() as {
      customer_name: string;
      user_id?: number;
      order_date?: string;
      menu_id: number;
      quantity?: number;
    };
    const { customer_name, user_id, order_date, menu_id, quantity = 1 } = body;
    if (!customer_name || !menu_id) {
      return new Response("Bad Request", { status: 400 });
    }

    const targetDate = order_date || new Date().toISOString().split("T")[0];

    // Check if date is locked
    const isLocked = db.query("SELECT id FROM locked_dates WHERE locked_date = $date")
      .get({ $date: targetDate });
    
    if (isLocked) {
      return Response.json(
        { error: "Bestellungen für diesen Tag sind fixiert und können nicht mehr aufgegeben werden." },
        { status: 403 }
      );
    }

    // Check if user already has an order for this date
    if (user_id) {
      const existingOrder = db.query(`
        SELECT id FROM orders 
        WHERE user_id = $user_id AND order_date = $order_date
      `).get({ $user_id: user_id, $order_date: targetDate });
      
      if (existingOrder) {
        return Response.json(
          { error: "Du hast bereits eine Bestellung für diesen Tag." },
          { status: 400 }
        );
      }
    }

    // Get menu price and check availability
    const menu = db.query("SELECT price FROM menus WHERE id = $id").get({ $id: menu_id }) as { price: number } | null;
    if (!menu) {
      return Response.json({ error: "Menü nicht gefunden." }, { status: 404 });
    }

    // Check max_quantity limit for this menu on this date
    const menuDay = db.query(`
      SELECT max_quantity FROM menu_days 
      WHERE menu_id = $menu_id AND available_date = $date
    `).get({ $menu_id: menu_id, $date: targetDate }) as { max_quantity: number | null } | null;

    if (menuDay && menuDay.max_quantity !== null) {
      // Count already ordered quantity for this menu on this date
      const orderedCount = db.query(`
        SELECT COALESCE(SUM(oi.quantity), 0) as total
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.menu_id = $menu_id AND o.order_date = $date
      `).get({ $menu_id: menu_id, $date: targetDate }) as { total: number };

      const remaining = menuDay.max_quantity - orderedCount.total;
      
      if (remaining <= 0) {
        return Response.json(
          { error: "Dieses Menü ist für diesen Tag bereits ausverkauft." },
          { status: 400 }
        );
      }
      
      if (quantity > remaining) {
        return Response.json(
          { error: `Nur noch ${remaining} Stück verfügbar.` },
          { status: 400 }
        );
      }
    }

    const total = menu.price * quantity;

    db.query("INSERT INTO orders (customer_name, user_id, order_date, total) VALUES ($name, $user_id, $order_date, $total)")
      .run({ $name: customer_name, $user_id: user_id ?? null, $order_date: targetDate, $total: total });
    const order = db.query("SELECT last_insert_rowid() as id").get() as { id: number };

    db.query("INSERT INTO order_items (order_id, menu_id, quantity, price_at_order) VALUES ($order_id, $menu_id, $quantity, $price)")
      .run({ $order_id: order.id, $menu_id: menu_id, $quantity: quantity, $price: menu.price });

    return Response.json({ id: order.id, total }, { status: 201 });
  }

  // DELETE /api/orders/:id - Admin löscht Bestellung nach ID (auch für fixierte Tage erlaubt)
  const matchDelete = path.match(/^\/api\/orders\/(\d+)$/);
  if (req.method === "DELETE" && matchDelete) {
    const orderId = parseInt(matchDelete[1]);
    
    const order = db.query("SELECT id FROM orders WHERE id = $id").get({ $id: orderId }) as { id: number } | null;
    
    if (!order) {
      return Response.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
    }

    db.query("DELETE FROM order_items WHERE order_id = $order_id").run({ $order_id: orderId });
    db.query("DELETE FROM orders WHERE id = $order_id").run({ $order_id: orderId });

    return Response.json({ success: true });
  }

  // DELETE /api/orders?user_id=X&date=YYYY-MM-DD
  if (req.method === "DELETE" && path === "/api/orders") {
    const userId = url.searchParams.get("user_id");
    const date = url.searchParams.get("date");
    
    if (!userId || !date) {
      return Response.json({ error: "user_id und date erforderlich." }, { status: 400 });
    }

    // Prüfe ob Datum fixiert ist
    const isLocked = db.query("SELECT id FROM locked_dates WHERE locked_date = $date")
      .get({ $date: date });
    
    if (isLocked) {
      return Response.json({ error: "Bestellungen für diesen Tag sind fixiert und können nicht mehr geändert werden." }, { status: 403 });
    }

    const order = db.query(`
      SELECT id FROM orders WHERE user_id = $user_id AND order_date = $date
    `).get({ $user_id: parseInt(userId), $date: date }) as { id: number } | null;

    if (!order) {
      return Response.json({ error: "Keine Bestellung gefunden." }, { status: 404 });
    }

    db.query("DELETE FROM order_items WHERE order_id = $order_id").run({ $order_id: order.id });
    db.query("DELETE FROM orders WHERE id = $order_id").run({ $order_id: order.id });

    return Response.json({ success: true });
  }

  return null;
}
