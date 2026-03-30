import { db } from "../db";

interface MenuRow {
  id: number;
  name: string;
  description: string;
  price: number;
  active: number;
  max_quantity: number | null;
  dates: string;
  created_at: string;
}

interface MenuWithAvailability extends MenuRow {
  remaining_quantity: number | null;
}

interface OrderedCountResult {
  total: number;
}

interface DbMenu {
  id: number;
  name: string;
  description: string;
  price: number;
  active: number;
  created_at: string;
}

export async function handleMenus(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname;

  // GET /api/menus?date=YYYY-MM-DD
  if (req.method === "GET" && path === "/api/menus") {
    const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const rows = db.query(`
      SELECT 
        m.*,
        md.max_quantity,
        GROUP_CONCAT(md.available_date) as dates
      FROM menus m
      JOIN menu_days md ON md.menu_id = m.id
      WHERE m.active = 1 AND md.available_date = $date
      GROUP BY m.id
      ORDER BY m.name
    `).all({ $date: date }) as MenuRow[];
    
    // Calculate remaining quantity for each menu
    const menusWithAvailability: MenuWithAvailability[] = rows.map(menu => {
      if (menu.max_quantity !== null) {
        const orderedCount = db.query(`
          SELECT COALESCE(SUM(oi.quantity), 0) as total
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.menu_id = $menu_id AND o.order_date = $date
        `).get({ $menu_id: menu.id, $date: date }) as OrderedCountResult;
        
        return {
          ...menu,
          remaining_quantity: menu.max_quantity - orderedCount.total
        };
      }
      return { ...menu, remaining_quantity: null };
    });
    
    return Response.json(menusWithAvailability);
  }

  // GET /api/menus/all (admin)
  if (req.method === "GET" && path === "/api/menus/all") {
    const rows = db.query(`
      SELECT 
        m.*,
        GROUP_CONCAT(md.available_date) as dates
      FROM menus m
      LEFT JOIN menu_days md ON m.id = md.menu_id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `).all();
    return Response.json(rows);
  }

  // GET /api/menus/available-dates - gibt alle Daten zurück, an denen Menüs verfügbar sind
  if (req.method === "GET" && path === "/api/menus/available-dates") {
    const rows = db.query(`
      SELECT DISTINCT md.available_date
      FROM menu_days md
      JOIN menus m ON m.id = md.menu_id
      WHERE m.active = 1
      ORDER BY md.available_date
    `).all() as { available_date: string }[];
    return Response.json(rows.map(r => r.available_date));
  }

  // GET /api/menus/:id
  const matchGet = path.match(/^\/api\/menus\/(\d+)$/);
  if (req.method === "GET" && matchGet) {
    const id = parseInt(matchGet[1]);
    const menu = db.query(`SELECT * FROM menus WHERE id = $id`).get({ $id: id });
    if (!menu) return new Response("Not Found", { status: 404 });
    const menuDays = db.query(`SELECT available_date, max_quantity FROM menu_days WHERE menu_id = $id ORDER BY available_date`).all({ $id: id }) as { available_date: string; max_quantity: number | null }[];
    return Response.json({ 
      ...menu as object, 
      dates: menuDays.map((d) => d.available_date),
      menuDays: menuDays
    });
  }

  // POST /api/menus
  if (req.method === "POST" && path === "/api/menus") {
    return handleCreate(req);
  }

  // PUT /api/menus/:id
  const matchPut = path.match(/^\/api\/menus\/(\d+)$/);
  if (req.method === "PUT" && matchPut) {
    return handleUpdate(req, parseInt(matchPut[1]));
  }

  // POST /api/menus/:id/copy
  const matchCopy = path.match(/^\/api\/menus\/(\d+)\/copy$/);
  if (req.method === "POST" && matchCopy) {
    return handleCopy(parseInt(matchCopy[1]));
  }

  // DELETE /api/menus/:id
  const matchDelete = path.match(/^\/api\/menus\/(\d+)$/);
  if (req.method === "DELETE" && matchDelete) {
    return handleDelete(parseInt(matchDelete[1]));
  }

  return null;
}

async function handleCreate(req: Request): Promise<Response> {
  const body = await req.json();
  const { name, description, price, active = 1, dates = [], menuDays = [] } = body;
  
  const result = db.query(`
    INSERT INTO menus (name, description, price, active)
    VALUES ($name, $description, $price, $active)
  `).run({
    $name: name,
    $description: description || "",
    $price: price,
    $active: active,
  });
  
  const menuId = result.lastInsertRowid as number;
  
  // Insert dates with max_quantity
  if (menuDays.length > 0) {
    const insertDate = db.prepare("INSERT INTO menu_days (menu_id, available_date, max_quantity) VALUES ($menu_id, $date, $max_quantity)");
    for (const menuDay of menuDays) {
      insertDate.run({ 
        $menu_id: menuId, 
        $date: menuDay.available_date, 
        $max_quantity: menuDay.max_quantity || null 
      });
    }
  } else if (dates.length > 0) {
    // Fallback for old format
    const insertDate = db.prepare("INSERT INTO menu_days (menu_id, available_date) VALUES ($menu_id, $date)");
    for (const date of dates) {
      insertDate.run({ $menu_id: menuId, $date: date });
    }
  }
  
  return Response.json({ id: menuId });
}

async function handleUpdate(req: Request, id: number): Promise<Response> {
  const body = await req.json();
  const { name, description, price, active, dates = [], menuDays = [] } = body;
  
  db.query(`
    UPDATE menus 
    SET name = $name, description = $description, price = $price, active = $active
    WHERE id = $id
  `).run({
    $name: name,
    $description: description || "",
    $price: price,
    $active: active,
    $id: id,
  });
  
  // Update dates
  db.query("DELETE FROM menu_days WHERE menu_id = $id").run({ $id: id });
  
  if (menuDays.length > 0) {
    const insertDate = db.prepare("INSERT INTO menu_days (menu_id, available_date, max_quantity) VALUES ($menu_id, $date, $max_quantity)");
    for (const menuDay of menuDays) {
      insertDate.run({ 
        $menu_id: id, 
        $date: menuDay.available_date, 
        $max_quantity: menuDay.max_quantity || null 
      });
    }
  } else if (dates.length > 0) {
    // Fallback for old format
    const insertDate = db.prepare("INSERT INTO menu_days (menu_id, available_date) VALUES ($menu_id, $date)");
    for (const date of dates) {
      insertDate.run({ $menu_id: id, $date: date });
    }
  }
  
  return Response.json({ success: true });
}

function handleCopy(id: number): Response {
  const original = db.query("SELECT * FROM menus WHERE id = $id").get({ $id: id }) as DbMenu | null;
  
  if (!original) return new Response("Not Found", { status: 404 });
  
  const result = db.query(`
    INSERT INTO menus (name, description, price, active)
    VALUES ($name, $description, $price, $active)
  `).run({
    $name: `${original.name} (Kopie)`,
    $description: original.description,
    $price: original.price,
    $active: 0,
  });
  
  return Response.json({ id: result.lastInsertRowid });
}

function handleDelete(id: number): Response {
  db.query("DELETE FROM menus WHERE id = $id").run({ $id: id });
  return Response.json({ success: true });
}
