# Tailwind CSS Setup

Tailwind CSS has been configured using **CDN** (no npm install required).

## How it works

Tailwind CSS is loaded via CDN in `public/index.html`. This means:
- ✅ No npm install needed
- ✅ Works immediately after restarting the dev server
- ✅ All Tailwind utility classes are available
- ✅ Custom colors are configured (primary color palette)

## Configuration

The Tailwind configuration is in `public/index.html`:
```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: { /* custom colors */ }
        }
      }
    }
  }
</script>
```

## Usage

You can now use any Tailwind class in your components:
- `bg-blue-600`, `text-white`, `rounded-lg`
- `flex`, `grid`, `gap-4`
- `p-4`, `m-2`, `w-full`
- And all other Tailwind utilities!

## Note

The `tailwind.config.js` and `postcss.config.js` files in the root are **not used** with the CDN approach, but they're kept for reference if you want to switch to a build-time setup later.


