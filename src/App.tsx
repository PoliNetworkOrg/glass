import { Glass, GlassProvider } from "../lib"
import "./App.css"

function App() {
  return (
    <GlassProvider>
      <h1>Hello World</h1>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "fixed",
          margin: "auto",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 300,
          height: 200,
        }}
      >
        <Glass options={{}}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              backgroundColor: "transparent",
            }}
          >
            <span>ciao!</span>
          </div>
        </Glass>
        <Glass options={{}} reducedMotion>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              backgroundColor: "transparent",
            }}
          >
            <span>ciao!</span>
          </div>
        </Glass>
      </div>
      {/* <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas non faucibus purus, ut auctor mauris. Praesent
        ut convallis tellus. Donec consequat erat eu enim feugiat lacinia. Morbi at tellus luctus elit ornare dictum.
        Donec vitae pulvinar augue. Praesent sed viverra nulla. Vestibulum aliquet libero sit amet pharetra ultrices.
        Aliquam suscipit sem quam, vitae vehicula elit sodales eget. Maecenas porttitor consectetur velit, eget eleifend
        neque hendrerit eu. Phasellus cursus aliquet dictum. Nam ullamcorper bibendum dapibus. Ut tempus, augue nec
        egestas imperdiet, sem enim rutrum sem, ut commodo erat nibh vel risus. In sed iaculis urna, ac blandit nisi.
      </p>
      <p>
        Sed facilisis ligula vitae rutrum laoreet. Vestibulum id ultricies turpis. Praesent fringilla est sed ornare
        dignissim. Donec lacinia commodo sapien ac interdum. Praesent ut tellus lorem. Morbi rutrum malesuada tincidunt.
        Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Aliquam et consequat
        lacus.
      </p>
      <p>
        Donec nec viverra risus. Cras at eros vitae mauris elementum vestibulum. Sed porttitor lobortis sodales. Duis
        eleifend justo sed diam ullamcorper congue. Quisque accumsan sem sed urna laoreet, sed vehicula ipsum pretium.
        Proin mauris nisi, fermentum sit amet ligula a, maximus feugiat erat. Aenean interdum arcu ut nunc porta congue.
        Pellentesque volutpat interdum enim vitae laoreet. Nunc ligula ligula, fermentum nec libero ac, tincidunt
        convallis velit.
      </p>
      <p>
        Sed elementum lorem sapien, eu porta quam faucibus nec. Praesent diam neque, posuere eget elit vel, pharetra
        facilisis magna. Nunc non fermentum neque. Vestibulum laoreet enim quis venenatis molestie. Aliquam erat
        volutpat. Vestibulum nec fermentum mi, non ullamcorper purus. Nulla nec ornare enim, eu auctor est.
      </p>
      <p>
        In ac purus non lectus rhoncus faucibus. Aenean ut consequat nisi. Mauris venenatis erat eget dolor mollis
        tincidunt. Fusce ornare nisl quis massa porta feugiat. Vestibulum varius, ex et egestas molestie, erat est
        fringilla ex, eu cursus est sem non magna. Vestibulum scelerisque rhoncus est sed egestas. Proin et feugiat
        sapien.
      </p>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas non faucibus purus, ut auctor mauris. Praesent
        ut convallis tellus. Donec consequat erat eu enim feugiat lacinia. Morbi at tellus luctus elit ornare dictum.
        Donec vitae pulvinar augue. Praesent sed viverra nulla. Vestibulum aliquet libero sit amet pharetra ultrices.
        Aliquam suscipit sem quam, vitae vehicula elit sodales eget. Maecenas porttitor consectetur velit, eget eleifend
        neque hendrerit eu. Phasellus cursus aliquet dictum. Nam ullamcorper bibendum dapibus. Ut tempus, augue nec
        egestas imperdiet, sem enim rutrum sem, ut commodo erat nibh vel risus. In sed iaculis urna, ac blandit nisi.
      </p>
      <p>
        Sed facilisis ligula vitae rutrum laoreet. Vestibulum id ultricies turpis. Praesent fringilla est sed ornare
        dignissim. Donec lacinia commodo sapien ac interdum. Praesent ut tellus lorem. Morbi rutrum malesuada tincidunt.
        Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Aliquam et consequat
        lacus.
      </p>
      <p>
        Donec nec viverra risus. Cras at eros vitae mauris elementum vestibulum. Sed porttitor lobortis sodales. Duis
        eleifend justo sed diam ullamcorper congue. Quisque accumsan sem sed urna laoreet, sed vehicula ipsum pretium.
        Proin mauris nisi, fermentum sit amet ligula a, maximus feugiat erat. Aenean interdum arcu ut nunc porta congue.
        Pellentesque volutpat interdum enim vitae laoreet. Nunc ligula ligula, fermentum nec libero ac, tincidunt
        convallis velit.
      </p>
      <p>
        Sed elementum lorem sapien, eu porta quam faucibus nec. Praesent diam neque, posuere eget elit vel, pharetra
        facilisis magna. Nunc non fermentum neque. Vestibulum laoreet enim quis venenatis molestie. Aliquam erat
        volutpat. Vestibulum nec fermentum mi, non ullamcorper purus. Nulla nec ornare enim, eu auctor est.
      </p>
      <p>
        In ac purus non lectus rhoncus faucibus. Aenean ut consequat nisi. Mauris venenatis erat eget dolor mollis
        tincidunt. Fusce ornare nisl quis massa porta feugiat. Vestibulum varius, ex et egestas molestie, erat est
        fringilla ex, eu cursus est sem non magna. Vestibulum scelerisque rhoncus est sed egestas. Proin et feugiat
        sapien.
      </p> */}
    </GlassProvider>
  )
}

export default App
