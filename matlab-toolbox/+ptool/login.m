function token = login(baseUrl, opts)
    %LOGIN OAuth-style device flow for the Engineering Tool.
    %
    %   token = ptool.login('https://app.example.com/api/v1')
    %
    %   Opens the project's auth URL in the system browser, prompts
    %   the user to paste back the resulting JWT, and caches the
    %   token under prefdir for subsequent sessions.
    arguments
        baseUrl (1,1) string
        opts.UseCache (1,1) logical = true
    end
    cacheFile = fullfile(prefdir, 'engineering-tool-matlab.token.mat');
    if opts.UseCache && exist(cacheFile, 'file')
        loaded = load(cacheFile, 'token', 'expiresAt');
        if loaded.expiresAt > now * 86400
            token = loaded.token;
            return;
        end
    end
    settingsUrl = char(replace(baseUrl, '/api/v1', '/settings'));
    web(settingsUrl, '-browser');
    token = strtrim(input('Paste your auth token: ', 's')); %#ok<NASGU>
    expiresAt = now * 86400 + 7 * 24 * 60 * 60; %#ok<NASGU>
    save(cacheFile, 'token', 'expiresAt');
end
