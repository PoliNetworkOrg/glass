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
- [ ] make it responsive
  - [ ] redo the screenshot on resize
  - [ ] make it work on zoom
- [ ] create the geometry
  - [ ] box with rounded edges via path extrude
  - [ ] maybe vector math in rust in WASM?
- [ ] do the glass thing
  - [ ] frost !
  - [ ] refraction
  - [ ] reflection
  - [ ] fresnel 
  - [ ] chromatic aberration ?
- [ ] performance
  - [ ] check webgl support
  - [ ] make sure it does not explode (like profiling maybe?)
- [ ] accessibility
  - [ ] stop it when user has reduced motion enabled
  - [ ] increased contrast ?