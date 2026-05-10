function n = pullToSldd(client, ddPath, opts)
    %PULLTOSLDD Pull the project's parameters into a Simulink Data Dictionary.
    %
    %   n = ptool.pullToSldd(client, 'myDict.sldd')
    %       Updates existing entries; appends new ones.
    %   n = ptool.pullToSldd(client, 'myDict.sldd', Replace=true)
    %       Removes entries that no longer exist on the server.
    arguments
        client (1,1) ptool.ParameterToolClient
        ddPath (1,1) string
        opts.Replace (1,1) logical = false
    end
    if ~exist('Simulink.data.dictionary.open', 'file')
        error('ptool:noSimulink', 'Simulink required.');
    end
    if ~isfile(ddPath)
        Simulink.data.dictionary.create(char(ddPath));
    end
    dd = Simulink.data.dictionary.open(char(ddPath));
    cleanup = onCleanup(@() dd.saveChanges()); %#ok<NASGU>
    section = dd.getSection('Design Data');

    remote = client.list();
    n = 0;
    seen = string([]);
    for k = 1:height(remote)
        name = char(remote.name(k));
        value = ptool.stringToValue(string(remote.defaultValue(k)), string(remote.dataType(k)));
        seen(end+1) = string(name); %#ok<AGROW>
        try
            entry = section.getEntry(name);
            entry.Value = value;
        catch
            section.addEntry(name, value);
        end
        n = n + 1;
    end

    if opts.Replace
        existing = section.find('-class', 'DataDictionary.Entry');
        for k = 1:numel(existing)
            if ~ismember(string(existing(k).Name), seen)
                existing(k).delete();
            end
        end
    end
end
