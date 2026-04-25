import { Callout, Kbd, CodeBlock } from '../helpComponents'

const linkParamExample = `# Example: a CAN bus carrying battery telemetry
Bus    : vehicle_can_1   (protocol = can, bitrate = 500000)
Message: BATT_STATUS_1   (id = 0x18FF50E5, period = 100ms, direction = tx)
Field  : pack_voltage    (uint16, start=0, length=16, scale=0.01, offset=0,
                          unit=V, linkedParameter=v_pack_total)
Field  : pack_current    (int16,  start=16, length=16, scale=0.1,  offset=0,
                          unit=A, linkedParameter=i_pack)
Field  : soc_percent     (uint8,  start=32, length=8,  scale=0.5,  offset=0,
                          unit=%,  linkedParameter=soc_battery)`

export default function CommunicationsSection() {
  return (
    <>
      <p>
        The Communications tab on the Parameters page models the buses that carry
        parameter values between systems. The hierarchy is{' '}
        <strong>bus → message → field</strong>, and a field can link back to a
        parameter so values stay in sync end-to-end.
      </p>
      <p>
        Reach it by opening any project and selecting <strong>Parameters</strong>{' '}
        from the sidebar, then the <strong>Communications</strong> tab in the page
        header (right next to <strong>Parameters</strong>).
      </p>

      <h2 id="layout">Pane layout — three resizable columns</h2>
      <p>
        Three vertical panes from left to right. Drag the splitters between panes to
        resize; widths persist in <code>localStorage</code> so they stay set across
        sessions. The splitter shows a tooltip "Drag to resize" on hover.
      </p>
      <ol>
        <li>
          <strong>Buses</strong> — the list of buses defined for this project. Each
          row shows the bus name, an inline protocol pill (CAN orange, ROS green,
          DDS blue, …), description, and an action zone with{' '}
          <strong>Edit</strong> + <strong>Delete</strong> icons.
        </li>
        <li>
          <strong>Messages</strong> — every message defined on the selected bus,
          with name, identifier, period, direction, and field count.
        </li>
        <li>
          <strong>Fields</strong> — the fields of the selected message. Each row
          carries name, type, bit/byte placement, scale + offset, and the optional
          parameter linkage with a deep-link to that parameter.
        </li>
      </ol>

      <h2 id="filter">Bus filter bar</h2>
      <p>
        At the top of the bus pane:
      </p>
      <ul>
        <li>
          <strong>Search box</strong> — debounced free text. Matches bus name and
          description, case-insensitive substring. The "<strong>×</strong>" inside the
          input clears it.
        </li>
        <li>
          <strong>Protocol pills</strong> — multi-select. Click any of{' '}
          <code>can</code>, <code>ros</code>, <code>dds</code>, <code>xtce</code>,{' '}
          <code>mavlink</code>, <code>autosar</code>, <code>mqtt</code>,{' '}
          <code>custom</code> to toggle filtering. Selected pills get a coloured
          background.
        </li>
        <li>
          <strong>Clear all</strong> — small button that resets both the search and
          the protocol pills in one shot.
        </li>
      </ul>
      <Callout variant="tip" title="Has-unlinked-fields toggle">
        A toggle next to the protocol pills surfaces buses where at least one field
        is NOT yet linked to a parameter. Use it before a release to find loose
        ends.
      </Callout>

      <h2 id="create-bus">Create a bus — every field</h2>
      <ol>
        <li>Click <strong>+ New bus</strong> at the top of the bus pane.</li>
        <li>
          The list collapses; an inline form appears with these inputs:
          <ul>
            <li>
              <strong>Bus name *</strong> (auto-focused) — required, unique within
              the project. Lowercase + underscores recommended.
            </li>
            <li>
              <strong>Protocol</strong> — dropdown.{' '}
              <code>can | ros | dds | xtce | mavlink | autosar | mqtt | custom</code>.
              Picking one reveals protocol-specific fields below.
            </li>
            <li>
              <strong>Description</strong> — optional, free text. Shown under the
              name in the list.
            </li>
            <li>
              <strong>Bitrate / topic prefix / namespace</strong> — protocol-dependent.
              CAN asks for bitrate (e.g. <code>500000</code>). ROS asks for the topic
              prefix (e.g. <code>/vehicle</code>). XTCE asks for the namespace.
            </li>
          </ul>
        </li>
        <li>Click <strong>Save</strong>. The bus appears in the list and is auto-selected.</li>
        <li>Click <strong>Cancel</strong> at any time to abort.</li>
      </ol>
      <Callout variant="tip" title="Bus naming">
        Use lowercase + underscores so the value round-trips through generated
        headers without name-mangling. Avoid colons and slashes. Examples:{' '}
        <code>vehicle_can_1</code>, <code>flight_dds_telemetry</code>,{' '}
        <code>ros_perception</code>.
      </Callout>

      <h2 id="edit-delete-bus">Edit and delete a bus</h2>
      <p>
        Hover any bus row to reveal:
      </p>
      <ul>
        <li>
          <strong>Edit</strong> (pencil icon, title "Edit") — opens the same form as
          create, pre-filled. <Kbd>Enter</Kbd> commits.
        </li>
        <li>
          <strong>Delete</strong> (trash icon, title "Delete") — confirmation:{' '}
          <em>"Delete bus 'X'? This will also delete N messages and M fields."</em>{' '}
          Cascade is real — deletion cannot be undone short of restoring from a
          backup.
        </li>
      </ul>

      <h2 id="create-message">Add a message</h2>
      <ol>
        <li>
          Select a bus on the left so the message pane shows its messages.
        </li>
        <li>
          Click <strong>+ New message</strong> in the message pane header.
        </li>
        <li>
          Fill in:
          <ul>
            <li>
              <strong>Message name *</strong> — required, unique within the bus.
              Example: <code>BATT_STATUS_1</code>.
            </li>
            <li>
              <strong>ID / PGN / topic</strong> — protocol-dependent identifier.
              Examples: CAN <code>0x18FF50E5</code>; ROS <code>/battery/status</code>;
              MAVLink message id <code>147</code>.
            </li>
            <li>
              <strong>Period (ms)</strong> — optional. Cyclic messages set this;
              event-driven messages leave blank.
            </li>
            <li>
              <strong>Direction</strong> — <code>tx</code> (sent), <code>rx</code>{' '}
              (received), or <code>bidirectional</code>.
            </li>
            <li>
              <strong>Description</strong> — optional, free text.
            </li>
          </ul>
        </li>
        <li>Click <strong>Save</strong> — message is selected; field pane opens empty.</li>
      </ol>

      <h2 id="edit-delete-message">Edit and delete a message</h2>
      <p>
        Hover the message row for <strong>Edit</strong> + <strong>Delete</strong>{' '}
        icons. Same behaviour as bus actions; deleting a message cascades to its
        fields.
      </p>

      <h2 id="create-field">Add a field — full reference</h2>
      <ol>
        <li>
          With a message selected, click <strong>+ New field</strong> in the field
          pane header.
        </li>
        <li>
          The field list shows an inline editor with these inputs:
          <ul>
            <li>
              <strong>Field name *</strong> (auto-focused) — required, unique
              within the message. Placeholder: <code>e.g. engine_speed</code>.
              Lowercase + underscores recommended.
            </li>
            <li>
              <strong>Data type</strong> — placeholder:{' '}
              <code>e.g. uint16, float32</code>. Accepts any type from the project's
              data-type registry plus the canonical primitives (<code>uint8</code>,{' '}
              <code>uint16</code>, <code>uint32</code>, <code>int8/16/32</code>,{' '}
              <code>float32</code>, <code>float64</code>, <code>bool</code>) and any
              project-defined enum.
            </li>
            <li>
              <strong>Start bit</strong> — bit offset within the message payload.
              Example: <code>0</code> for the first field, <code>16</code> for one
              that follows a 16-bit field.
            </li>
            <li>
              <strong>Length (bits)</strong> — width of the field in bits. Standard
              widths are 1, 8, 16, 32, 64. Validation prevents overlap with other
              fields in the same message.
            </li>
            <li>
              <strong>Scale</strong> — multiplier for physical-value conversion:{' '}
              <code>physical = raw * scale + offset</code>. Default 1. Example:{' '}
              <code>0.01</code> for a voltage encoded in 10-mV ticks.
            </li>
            <li>
              <strong>Offset</strong> — bias added after scaling. Default 0.
              Example: <code>-40</code> for a temperature with <code>0 = -40 °C</code>.
            </li>
            <li>
              <strong>Unit</strong> — pulled from the project unit registry.
              Examples: <code>V</code>, <code>A</code>, <code>°C</code>, <code>%</code>,{' '}
              <code>rpm</code>, <code>m/s</code>.
            </li>
            <li>
              <strong>Min / Max</strong> — optional physical bounds for sanity
              checking; values outside reject on import.
            </li>
            <li>
              <strong>Linked parameter</strong> — typeahead combobox over the
              project's parameters. Picking one binds this field to that parameter so
              their values are kept in sync at round-trip time. Leaving blank means
              the field carries an unbound value (you'll see it in the
              "has unlinked fields" filter).
            </li>
            <li>
              <strong>Description</strong> — optional, placeholder{' '}
              <code>Optional description</code>.
            </li>
          </ul>
        </li>
        <li>Click <strong>Save</strong> (disabled while name is empty or save in flight).</li>
        <li>Click <strong>Cancel</strong> to discard.</li>
      </ol>

      <Callout variant="note" title="Linked parameters and ITAR">
        If you link a field to an ITAR-classified parameter, the field inherits the
        same classification. MCP keys without ITAR scope cannot read it.
      </Callout>

      <h2 id="edit-delete-field">Edit and delete a field</h2>
      <p>
        Hover the field row for <strong>Edit</strong> + <strong>Delete</strong>{' '}
        icons. Edit opens the same inline editor pre-filled; delete asks for
        confirmation.
      </p>

      <h2 id="example-end-to-end">Worked example</h2>
      <p>
        End-to-end definition of a battery telemetry CAN bus with three linked
        fields:
      </p>
      <CodeBlock>{linkParamExample}</CodeBlock>
      <p>
        After this is set up, pushing a new value to <code>v_pack_total</code> in
        the parameters page (or via the REST/MCP API) automatically updates the{' '}
        <code>pack_voltage</code> field's expected value, and any export of the bus
        as a DBC file uses the new physical reference.
      </p>

      <h2 id="export">Export bus definitions</h2>
      <p>
        From the bus row's <strong>⋯</strong> menu (where present) you can export a
        single bus:
      </p>
      <ul>
        <li><strong>DBC</strong> — Vector CAN database file (CAN buses only).</li>
        <li><strong>XTCE</strong> — XML telemetry / command exchange (XTCE buses).</li>
        <li><strong>MAVLink XML</strong> — MAVLink dialect XML (MAVLink buses).</li>
        <li><strong>JSON</strong> — generic dump for any protocol; round-trips through Import.</li>
      </ul>

      <h2 id="shortcuts">Shortcuts inside Communications</h2>
      <ul>
        <li><Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> — focuses the bus search box.</li>
        <li><Kbd>Esc</Kbd> — cancels any inline create/edit form (bus, message, or field).</li>
        <li><Kbd>Enter</Kbd> — saves the current inline form.</li>
        <li>Click a row anywhere outside the action icons to select it without triggering edit.</li>
      </ul>
    </>
  )
}
