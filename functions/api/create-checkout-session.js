
const PRODUCT_PRICES = {
  "NERROW Essential Tee": 3200,
  "Everyday Graphic Tee": 3800,
  "Classic Oversized Tee": 3500,
  "NERROW Logo Tee": 3200,
  "Relaxed Fit Pants": 5500,
  "Everyday Sweatpants": 5000,
  "Essential Crewneck": 6000,
  "Logo Zip Hoodie": 6500
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({
      error: "Stripe secret key is not configured."
    }, 500);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({
      error: "Invalid request."
    }, 400);
  }

  const cart = body?.cart;

  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 20) {
    return jsonResponse({
      error: "Your cart is empty or invalid."
    }, 400);
  }

  const params = new URLSearchParams();

  params.set("mode", "payment");

  const siteUrl = new URL(request.url).origin;

  params.set(
    "success_url",
    `${siteUrl}/?checkout=success`
  );

  params.set(
    "cancel_url",
    `${siteUrl}/?page=cart&checkout=cancel`
  );

  params.set(
    "shipping_address_collection[allowed_countries][0]",
    "US"
  );

  params.set("metadata[store]", "NERROW");

  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const name = typeof item.name === "string" ? item.name : "";
    const price = PRODUCT_PRICES[name];
    const quantity = Number(item.quantity);

    if (
      price === undefined ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return jsonResponse({
        error: "A product or quantity in your cart is invalid."
      }, 400);
    }

    const size = typeof item.size === "string"
      ? item.size.slice(0, 30)
      : "";

    const color = typeof item.color === "string"
      ? item.color.slice(0, 30)
      : "";

    params.set(
      `line_items[${i}][price_data][currency]`,
      "usd"
    );

    params.set(
      `line_items[${i}][price_data][unit_amount]`,
      String(price)
    );

    params.set(
      `line_items[${i}][price_data][product_data][name]`,
      name
    );

    params.set(
      `line_items[${i}][price_data][product_data][description]`,
      `Size: ${size || "Not specified"} | Color: ${color || "Not specified"}`
    );

    params.set(
      `line_items[${i}][quantity]`,
      String(quantity)
    );
  }

  const stripeResponse = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    }
  );

  const result = await stripeResponse.json();

  if (!stripeResponse.ok) {
    return jsonResponse({
      error: result.error?.message || "Stripe could not create checkout."
    }, 502);
  }

  return jsonResponse({
    url: result.url
  });
}
