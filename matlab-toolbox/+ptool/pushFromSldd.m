function n = pushFromSldd(client, ddPath)
    %PUSHFROMSLDD Read a Simulink Data Dictionary and push every entry.
    %
    %   n = ptool.pushFromSldd(client, 'myDict.sldd')
    %
    %   Uses the in-MATLAB Simulink.data.dictionary API so the
    %   correct version-specific format is owned by MATLAB itself.
    %   Requires Simulink.
    arguments
        client (1,1) ptool.ParameterToolClient
        ddPath (1,1) string
    end
    if ~exist('Simulink.data.dictionary.open', 'file')
        error('ptool:noSimulink', ...
            'Simulink is required to read .sldd files.');
    end
    dd = Simulink.data.dictionary.open(char(ddPath));
    cleanup = onCleanup(@() dd.close()); %#ok<NASGU>
    section = dd.getSection('Design Data');
    entries = section.find('-value', '-class', 'DataDictionary.Entry');
    n = 0;
    for k = 1:numel(entries)
        e = entries(k);
        client.create(struct( ...
            'name',         e.Name, ...
            'dataType',     ptool.classToDataType(class(e.Value)), ...
            'defaultValue', ptool.valueToString(e.Value), ...
            'description',  ['Imported from ' char(ddPath)], ...
            'status',       'draft'));
        n = n + 1;
    end
end
