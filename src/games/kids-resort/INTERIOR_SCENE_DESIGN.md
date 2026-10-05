# Kids Resort Interior Scene Design Reference

This file defines the shared interior-design method for Kids Resort locations. It should be used when creating or redesigning interiors such as the Resort Lobby, Sunshine Café, Design Studio, Market Street, Resort Bank, Emily's House, and future locations.

## Core Principle

A Kids Resort location should feel like a place the player character is physically inside, not like a dashboard placed on top of a themed background.

The room itself is the interface.

The current Sunshine Café and Design Studio are the main reference implementations for this direction.

## Interior Composition

Each interior should be presented as a room scene with:

- one primary visible wall
- the floor extending toward the player
- furniture, fixtures, counters, displays, stations, doors, signs, or other objects arranged naturally in that room
- the player character visibly standing or sitting in the environment

The scene should read first as a physical place and second as a game interface.

Avoid replacing the room with a collection of dashboard cards, floating panels, or menu tiles when the same choices can be represented by objects in the environment.

## Objects Are Interaction Choices

On the main page for a location or building, physical objects in the room should represent the available mini-games, jobs, customer modes, or other play modes.

For example, a player should understand that a salon chair, art table, clothing rack, café counter, kitchen station, dining table, or similar object is something they can interact with.

The object should belong naturally in the room while also functioning as the entry point to that activity.

Whenever possible:

1. show the activity as a real object or station in the environment
2. make that object the clickable or tappable interaction target
3. avoid adding a separate dashboard button for the same activity unless a supplemental control is genuinely necessary

## Character Presence

The main player character should be visibly present in every interior scene.

For now, character placement is primarily spatial reference. The character does not need to physically walk to, touch, operate, or animate with every object yet.

The purpose is to establish that:

- the character is actually in the room
- the room has believable scale
- furniture and stations are positioned in relation to the character
- future interaction can be added without redesigning the scene around a dashboard

Later implementations can add movement and direct object interaction while preserving this room layout.

## Customers and Other Characters

When the current play mode involves serving, styling, helping, dining with, or otherwise interacting with a customer, that customer should also be visibly present in the environment.

Their placement should communicate the activity spatially.

Examples include:

- a café customer waiting at or sitting near the appropriate service area
- a dining customer actually seated at a table
- a beauty customer positioned at the salon station
- a fashion customer positioned at the relevant fitting or styling area

Characters should look like occupants of the scene, not portraits or UI decorations floating beside the activity.

## Full-Screen Scene Framing

Interior content should remain fully visible across screen sizes and orientations.

The important room composition should be treated as a complete scene that fits within the available viewport rather than being cropped unpredictably.

When the viewport aspect ratio creates unused horizontal or vertical margins, those margins should not become empty bars or unrelated UI space.

Instead, the room should visually continue into them:

- wall texture and color extend outward where wall margins appear
- floor texture and color extend outward where floor margins appear

This allows the central designed composition to stay intact while the surrounding room expands responsively to fill the screen.

The result should feel like a larger room is continuing beyond the designed composition, not like a fixed image has been letterboxed.

## Responsive Rule

Preserve the entire important room composition first.

Use responsive wall and floor extension to absorb differences in screen shape.

Do not solve small or unusual screens by allowing important stations, characters, or activity objects to disappear offscreen.

The intended behavior is:

- all essential content remains onscreen
- scene proportions remain coherent
- excess viewport area becomes additional wall and/or floor
- the room still reads as full-screen in portrait, landscape, desktop, tablet, and smaller displays

## Design Test

Before considering an interior complete, check that:

- it looks like a room rather than a dashboard
- the main character appears physically located in the room
- any current customer or participant also appears in the room
- the major play modes are represented by appropriate room objects or stations
- those interaction objects are understandable without relying on a separate grid of menu cards
- all essential scene content stays visible at different aspect ratios
- any extra margins are filled by naturally extending wall or floor
- the scene leaves room for future character movement and direct object interaction

## Direction for Future Interiors

This is the default interior language for Kids Resort unless a specific location requires an intentional exception.

New locations and redesigns should begin by asking:

**What room is the character standing in, and what physical objects in that room represent what the player can do here?**

That question should drive the layout before traditional UI controls are added.
