# glass
apple could never

```tsx

<GlassContextProvider>
  <div>
    <Glass style={{}}>
      <h1>Hello Glass</h1>
    </Glass>
  </div>
</GlassContextProvider>

```

## TODO:
- [ ] reactify the thingy
  - [ ] Error boundaries and Suspense to handle delays
- [x] make it responsive
  - [x] redo the screenshot on resize
  - [x] make it work on zoom
- [x] create the geometry
  - [x] box with rounded edges via path extrude
  - [ ] maybe vector math in rust in WASM?
- [x] do the glass thing
  - [x] frost !
  - [x] refraction
  - [x] reflection
  - [x] fresnel 
  - [x] chromatic aberration ?
- [ ] performance
  - [x] check webgl support
  - [ ] make sure it does not explode (like profiling maybe?)
- [x] accessibility
  - [x] stop it when user has reduced motion enabled
  - [x] increased contrast ?