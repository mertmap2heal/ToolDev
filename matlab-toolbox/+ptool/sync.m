function report = sync(client, opts)
    %SYNC Three-way merge: remote, local workspace, last baseline.
    %
    %   report = ptool.sync(client)
    %       returns a struct with:
    %         .pulled    parameters newly fetched into the workspace
    %         .pushed    workspace values written back to the server
    %         .conflicts {name, local, remote, baseline} for pairs that
    %                    diverged in both directions — resolve manually.
    %
    %   The "baseline" is whatever was last pulled into the workspace
    %   in this session, persisted under prefdir.
    arguments
        client (1,1) ptool.ParameterToolClient
        opts.AutoPushNew (1,1) logical = true
        opts.AutoPullNew (1,1) logical = true
    end

    baselineFile = fullfile(prefdir, 'engineering-tool-matlab.baseline.mat');
    baseline = struct();
    if exist(baselineFile, 'file')
        loaded = load(baselineFile, 'baseline');
        baseline = loaded.baseline;
    end

    remote = client.pull();
    local = struct();
    names = evalin('caller', 'who');
    for k = 1:numel(names)
        v = evalin('caller', names{k});
        if isnumeric(v) || islogical(v) || isstring(v) || ischar(v)
            local.(names{k}) = v;
        end
    end

    pulled = {};
    pushed = {};
    conflicts = {};

    allNames = unique([fieldnames(remote); fieldnames(local); fieldnames(baseline)]);
    for i = 1:numel(allNames)
        name = allNames{i};
        rHas = isfield(remote, name);
        lHas = isfield(local, name);
        bHas = isfield(baseline, name);
        if rHas && ~lHas && opts.AutoPullNew
            assignin('caller', name, remote.(name));
            pulled{end+1} = name; %#ok<AGROW>
        elseif ~rHas && lHas && opts.AutoPushNew
            client.create(struct('name', name, ...
                'dataType', ptool.classToDataType(class(local.(name))), ...
                'defaultValue', ptool.valueToString(local.(name)), ...
                'status', 'draft'));
            pushed{end+1} = name; %#ok<AGROW>
        elseif rHas && lHas
            rV = remote.(name);
            lV = local.(name);
            bV = []; if bHas, bV = baseline.(name); end
            if ~isequal(rV, lV)
                if isequal(rV, bV)
                    client.update(name, struct('defaultValue', ptool.valueToString(lV)));
                    pushed{end+1} = name; %#ok<AGROW>
                elseif isequal(lV, bV)
                    assignin('caller', name, rV);
                    pulled{end+1} = name; %#ok<AGROW>
                else
                    conflicts{end+1} = {name, lV, rV, bV}; %#ok<AGROW>
                end
            end
        end
    end

    baseline = remote; %#ok<NASGU>
    save(baselineFile, 'baseline');

    report = struct('pulled', {pulled}, 'pushed', {pushed}, 'conflicts', {conflicts});
end
