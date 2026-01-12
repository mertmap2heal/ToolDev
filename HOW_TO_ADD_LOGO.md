# How to Add an App Logo

## Current Implementation

I've added a logo component that displays in the header. Here's what was created:

### Logo Component
- **Location**: `frontend/src/components/Logo.tsx`
- **Features**:
  - Icon with gradient background
  - Optional text display
  - Different sizes (sm, md, lg)
  - Dark mode support

### Current Logo Design
- Uses a lightning bolt icon (⚡) in a blue gradient box
- Shows "Engineering Tool" text
- Subtitle: "Project Development"

## Customizing the Logo

### Option 1: Replace with Your Own Image

1. **Add your logo image** to `frontend/public/` folder:
   - Supported formats: SVG, PNG, JPG
   - Recommended size: 32x32px to 64x64px
   - Name it: `logo.png` or `logo.svg`

2. **Update Logo.tsx**:
   ```typescript
   import logoImage from '/logo.png'  // or '/logo.svg'
   
   export default function Logo({ size = 'md', showText = true }: LogoProps) {
     return (
       <div className="flex items-center gap-2">
         <img 
           src={logoImage} 
           alt="Engineering Tool Logo" 
           className="w-8 h-8"
         />
         {showText && (
           <span className="font-bold text-base text-gray-900 dark:text-white">
             Engineering Tool
           </span>
         )}
       </div>
     )
   }
   ```

### Option 2: Use SVG Logo

1. **Create or download an SVG logo**
2. **Save it** as `frontend/public/logo.svg`
3. **Update Logo.tsx** to use the SVG:
   ```typescript
   import { ReactComponent as LogoSvg } from '/logo.svg'
   
   // Then use: <LogoSvg className="w-8 h-8" />
   ```

### Option 3: Custom Icon from Lucide

Replace the `Zap` icon with any Lucide icon:

```typescript
import { Settings, Cpu, Code, Wrench } from 'lucide-react'

// Use any icon:
<Settings className="text-white" size={20} />
<Cpu className="text-white" size={20} />
<Code className="text-white" size={20} />
```

### Option 4: Text-Only Logo

Remove the icon, keep only text:

```typescript
export default function Logo({ showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            Engineering Tool
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Project Development
          </span>
        </div>
      )}
    </div>
  )
}
```

## Logo Placement Options

### Current: Top Left (Standard)
The logo is currently in the top left, which is standard practice.

### Move to Top Right
If you want it on the right side, update `Header.tsx`:

```typescript
<div className="flex items-center justify-between">
  {/* Search in center */}
  <div className="flex-1 max-w-md mx-8">
    {/* Search bar */}
  </div>
  
  {/* Logo on right */}
  <div className="flex items-center gap-4">
    <Logo size="md" showText={false} />
    {/* Other icons */}
  </div>
</div>
```

### Center Logo
```typescript
<div className="flex items-center justify-center flex-1">
  <Logo size="lg" showText={true} />
</div>
```

## Logo Sizes

The Logo component supports three sizes:

- **sm**: Small (16px icon, small text)
- **md**: Medium (20px icon, normal text) - **Default**
- **lg**: Large (24px icon, large text)

Usage:
```typescript
<Logo size="sm" showText={true} />   // Small logo
<Logo size="md" showText={true} />   // Medium (default)
<Logo size="lg" showText={false} />  // Large icon only
```

## Quick Customization Examples

### Simple Text Logo
```typescript
<div className="flex items-center gap-2">
  <span className="text-xl font-bold text-blue-600">ET</span>
  <span className="text-sm font-semibold text-gray-700">Engineering Tool</span>
</div>
```

### Image Logo
```typescript
<img 
  src="/logo.png" 
  alt="Logo" 
  className="h-8 w-auto"
/>
```

### Custom Styled Logo
```typescript
<div className="flex items-center gap-2">
  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
    <span className="text-white font-bold">ET</span>
  </div>
  <div>
    <div className="text-sm font-bold text-gray-900">Engineering Tool</div>
    <div className="text-xs text-gray-500">Project Development</div>
  </div>
</div>
```

## Where Logo Appears

Currently, the logo appears in:
- **Header** (top left) - Main navigation area

You can also add it to:
- **Sidebar** (top of navigation)
- **Login page** (when you create it)
- **Favicon** (browser tab icon)

## Adding Favicon (Browser Tab Icon)

1. **Create a favicon** (16x16 or 32x32 PNG)
2. **Save as** `frontend/public/favicon.ico` or `frontend/public/favicon.png`
3. **Update** `frontend/index.html`:
   ```html
   <link rel="icon" type="image/png" href="/favicon.png" />
   ```

## Current Logo Location

The logo is implemented in:
- **Component**: `frontend/src/components/Logo.tsx`
- **Used in**: `frontend/src/components/layout/Header.tsx`

To customize, edit the `Logo.tsx` file!
