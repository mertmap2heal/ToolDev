# Contributing Guidelines

## Development Workflow

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git commit -m "feat: add new feature"
   ```

3. Push and create a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

## Commit Message Format

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Format code with Prettier
- Write meaningful comments
- Keep functions small and focused

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test manually in development environment

## Pull Request Process

1. Update documentation if needed
2. Ensure CI checks pass
3. Request review from team members
4. Address review comments
5. Wait for approval before merging
