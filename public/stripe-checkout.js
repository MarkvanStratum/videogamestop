document.querySelectorAll('.stripe-buy').forEach(button=>button.addEventListener('click',()=>{window.location.href='/checkout.html?plan='+encodeURIComponent(button.dataset.plan);}));
