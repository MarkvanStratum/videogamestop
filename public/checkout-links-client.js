// Preserve existing pricing links as a fallback if the checkout-link service is unavailable.
document.querySelectorAll('a[href^="/checkout.html?plan="]').forEach(link => {
  link.addEventListener('click', async event => {
    event.preventDefault();
    const plan = new URL(link.href).searchParams.get('plan');
    const original = link.textContent;
    link.style.pointerEvents = 'none';
    try {
      const response = await fetch('/api/create-promo-checkout-link', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({plan,step2File:'checkout.html',sourcePage:location.pathname,originalQueryString:location.search,ref:new URLSearchParams(location.search).get('ref')||''})
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw Error(data.error || 'Checkout unavailable');
      location.assign(data.url);
    } catch (error) {
      alert(error.message || 'Could not start checkout. Please try again.');
      link.style.pointerEvents = '';
      link.textContent = original;
    }
  });
});
